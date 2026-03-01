/**
 * 从 output_qa.txt（或指定路径）导入八股文题目并同步提取关键词
 *
 * 文件格式：
 *   【分类名称】
 *
 *   问题行（以 ? 或 ？ 结尾）
 *   答案行（紧跟问题之后，直到下一道题或下一个分类）
 *
 * 用法：
 *   LLM_API_KEY=your-key npx tsx scripts/import-qa.ts [文件路径]
 *
 * 若不需要提取关键词，省略 LLM_API_KEY 即可，关键词字段留空。
 */
import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ─── LLM 客户端（可选） ─────────────────────────────────────────────────────────
const LLM_API_KEY = process.env.LLM_API_KEY;
const llm = LLM_API_KEY
  ? new OpenAI({
      apiKey: LLM_API_KEY,
      baseURL: "https://llm-gateway.momenta.works",
    })
  : null;

// ─── 类型 ────────────────────────────────────────────────────────────────────
interface ParsedItem {
  platform: string;
  title: string;
  answer: string;
}

// ─── 解析 output_qa.txt ──────────────────────────────────────────────────────
/**
 * 解析格式：
 *   - 【分类】 行作为 platform
 *   - 以 ? 或 ？ 结尾的行作为题目
 *   - 题目之后、下一道题之前的所有非空行合并为答案
 */
function parseQaTxt(content: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = content.split(/\r?\n/);

  let platform = "计算机基础";
  let title = "";
  let answerLines: string[] = [];

  function flush() {
    if (title) {
      items.push({
        platform,
        title: title.trim(),
        answer: answerLines.join("\n").trim(),
      });
      title = "";
      answerLines = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // 空行：跳过，不影响状态
    if (trimmed === "") continue;

    // 【分类】 行
    const categoryMatch = trimmed.match(/^【(.+?)】$/);
    if (categoryMatch) {
      flush();
      platform = categoryMatch[1];
      continue;
    }

    // 题目行（以 ? 或 ？ 结尾）
    if (trimmed.endsWith("?") || trimmed.endsWith("？")) {
      flush();
      title = trimmed;
      continue;
    }

    // 其余行：如果当前有题目则作为答案，否则作为新题目
    if (title) {
      answerLines.push(trimmed);
    } else {
      title = trimmed;
    }
  }

  flush();
  return items;
}

// ─── 全局速率限制器（控制 LLM 请求 ≤ 40 RPM） ────────────────────────────────
// 核心：用 lastRelease 时间戳保证每次放行间隔 ≥ intervalMs，
// 避免多个 worker 同时触发 drain 导致全部瞬间放行的问题。
class RateLimiter {
  private queue: Array<() => void> = [];
  private draining = false;
  private lastRelease = 0;
  private readonly intervalMs: number;

  constructor(requestsPerMinute: number) {
    this.intervalMs = Math.ceil((60 * 1000) / requestsPerMinute);
  }

  acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      if (!this.draining) this.drain();
    });
  }

  private async drain(): Promise<void> {
    this.draining = true;
    while (this.queue.length > 0) {
      // 距上次放行不足 intervalMs，则等够剩余时间
      const waitMs = this.intervalMs - (Date.now() - this.lastRelease);
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
      // await 期间队列可能已清空（极端情况）
      if (this.queue.length === 0) break;
      const next = this.queue.shift()!;
      this.lastRelease = Date.now();
      next();
    }
    this.draining = false;
  }
}

// 45 RPM 限制，留 5 余量，设 40 RPM → 每 1.5s 放行一个请求
const llmRateLimiter = new RateLimiter(40);

// ─── 关键词提取 ───────────────────────────────────────────────────────────────
async function extractKeywords(
  question: string,
  answer: string
): Promise<string> {
  if (!llm) return "";

  const prompt = `你是一个专业的技术面试助手。请根据以下八股文问题及其参考答案，提炼出能够概括核心内容的关键词短语。

**核心目标：** 看到这些关键词就能回忆起完整答案的要点，起到"记忆锚点"的作用。

**重要说明：** 参考答案可能不完整或有缺漏，请以题目本身为准，结合答案内容，确保关键词覆盖该问题的核心考点。

**要求：**
1. 关键词不是简单的术语罗列，而是对答案要点的精炼概括
2. 每个关键词/短语控制在 2-10 个字，可以是短句形式（如"红黑树优化链表"、"头插法导致环"）
3. 最多提取 5 个，按答案的逻辑顺序排列
4. 覆盖答案的主要层次：定义/是什么 → 原理/为什么 → 应用/怎么用
5. 只输出关键词，用英文逗号分隔，不要有其他解释
6. 格式：关键词1,关键词2,关键词3（英文逗号，无空格）

**问题：**
${question}

**参考答案：**
${answer}

**请提炼概括性关键词（只输出关键词，逗号分隔，最多5个）：**`;

  // 等待速率限制器放行
  await llmRateLimiter.acquire();

  const response = await llm.chat.completions.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0].message.content?.trim() ?? "";
}

// ─── SRS 排期 ─────────────────────────────────────────────────────────────────
function getNextReviewDate(intervalDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + intervalDays);
  d.setHours(6, 0, 0, 0);
  return d;
}

// ─── 单条处理 ─────────────────────────────────────────────────────────────────
async function processItem(
  item: ParsedItem,
  index: number,
  total: number,
  userId: string,
  counters: { imported: number; keywordsFailed: number }
): Promise<void> {
  const pid = `qa-${String(index + 1).padStart(4, "0")}`;
  const progress = `[${index + 1}/${total}]`;

  try {
    // 1. 提取关键词（有答案才调用）
    let keywords = "";
    if (llm && item.answer) {
      try {
        keywords = await extractKeywords(item.title, item.answer);
        console.log(`${progress} ✅ ${item.title.slice(0, 50)}`);
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        console.log(`${progress} ⚠️  关键词提取失败 [${msg.slice(0, 100)}]: ${item.title.slice(0, 40)}`);
        counters.keywordsFailed++;
      }
    } else {
      console.log(`${progress} 导入: ${item.title.slice(0, 50)}`);
    }

    // 2. upsert Problem
    const problem = await prisma.problem.upsert({
      where: { platform_pid: { platform: item.platform, pid } },
      update: {
        title: item.title,
        difficulty: "Medium",
        difficultyLevel: 2,
        tags: item.platform,
        answer: item.answer || null,
        ...(keywords ? { answerKeywords: keywords } : {}),
      },
      create: {
        platform: item.platform,
        pid,
        title: item.title,
        difficulty: "Medium",
        difficultyLevel: 2,
        tags: item.platform,
        answer: item.answer || null,
        answerKeywords: keywords || null,
      },
    });

    // 3. upsert Progress（每 20 题排一天）
    const intervalDays = Math.floor(index / 20);
    const nextReview = getNextReviewDate(intervalDays);

    await prisma.progress.upsert({
      where: { userId_problemId: { userId, problemId: problem.id } },
      update: {
        status: "Reviewing",
        nextReview,
        masteryLevel: 0,
        interval: intervalDays,
        easiness: 2.5,
      },
      create: {
        userId,
        problemId: problem.id,
        status: "Reviewing",
        masteryLevel: 0,
        interval: intervalDays,
        easiness: 2.5,
        reviewCount: 0,
        nextReview,
      },
    });

    counters.imported++;
  } catch (e) {
    console.error(
      `❌ 导入失败 [${item.platform}] ${item.title.slice(0, 30)}...`,
      e
    );
  }
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const inputPath =
    args[0] || path.join(process.cwd(), "output_qa.txt");

  if (!fs.existsSync(inputPath)) {
    console.error("文件不存在:", inputPath);
    console.error("用法: LLM_API_KEY=xxx npx tsx scripts/import-qa.ts [路径]");
    process.exit(1);
  }

  const content = fs.readFileSync(inputPath, "utf-8");
  const items = parseQaTxt(content);
  console.log(`解析到 ${items.length} 道题`);

  if (!llm) {
    console.warn(
      "⚠️  未设置 LLM_API_KEY，将跳过关键词提取（导入后可用 npm run extract:keywords 补充）"
    );
  }

  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("请先创建用户（例如在应用中注册）");
    process.exit(1);
  }

  const counters = { imported: 0, keywordsFailed: 0 };

  for (let i = 0; i < items.length; i++) {
    await processItem(items[i], i, items.length, user.id, counters);
  }

  console.log(`\n完成，共导入 ${counters.imported} 道题`);
  if (counters.keywordsFailed > 0) {
    console.log(
      `关键词提取失败 ${counters.keywordsFailed} 条（可后续运行 npm run extract:keywords 补充）`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
