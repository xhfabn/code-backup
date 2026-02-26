/**
 * 从 33.txt 或指定路径导入八股文题目到 Prisma
 * 格式：第一行或独立一行为 platform（如 JavaSE、MySQL）；以 ? 结尾的行为题目；题目下一行到下一题之间为答案
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface ParsedItem {
  platform: string;
  title: string;
  answer: string;
}

const PLATFORM_MAX_LEN = 50; // 视为 platform 的最大长度（短标题）

function parseBaguTxt(content: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = content.split(/\r?\n/);

  let platform = "计算机基础";
  let title = "";
  let answerLines: string[] = [];
  let lastWasBlank = true;

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

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // 空行
    if (trimmed === "") {
      lastWasBlank = true;
      continue;
    }

    // 可能的新 platform：较短、不含 ?/？、且（文件开头或上一行是空行），多为纯英文如 JavaSE/MySQL/Redis
    const isQuestionLine = trimmed.endsWith("?") || trimmed.endsWith("？");
    if (
      lastWasBlank &&
      !isQuestionLine &&
      trimmed.length <= PLATFORM_MAX_LEN &&
      /^[A-Za-z0-9\u4e00-\u9fff]+$/.test(trimmed)
    ) {
      flush();
      platform = trimmed;
      lastWasBlank = false;
      continue;
    }

    lastWasBlank = false;

    // 题目：以 ? 或全角 ？ 结尾（文件中多为全角）
    if (isQuestionLine) {
      flush();
      title = trimmed;
      answerLines = [];
      continue;
    }

    // 其余为答案（挂在当前题目下；若尚无题目则用该行作题目）
    if (title) {
      answerLines.push(raw);
    } else {
      title = trimmed;
      // 答案留空，下一行再开始累积
    }
  }

  flush();
  return items;
}

/** 从当前日期起第 intervalDays 天的早上 6 点，作为该题的下次复习时间 */
function getNextReviewDate(intervalDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + intervalDays);
  d.setHours(6, 0, 0, 0);
  return d;
}

async function main() {
  const args = process.argv.slice(2);
  const inputPath =
    args[0] ||
    path.join(process.cwd(), "33_backup.txt");

  if (!fs.existsSync(inputPath)) {
    console.error("文件不存在:", inputPath);
    console.error("用法: npx tsx scripts/import-bagu.ts [路径]");
    process.exit(1);
  }

  const content = fs.readFileSync(inputPath, "utf-8");
  const items = parseBaguTxt(content);

  console.log(`解析到 ${items.length} 道题`);

  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("请先创建用户（例如在应用中注册）");
    process.exit(1);
  }

  let imported = 0;
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  // 复习排期：每天 5 道题，从当前日期往后排
  // 第 0~4 题 → 今天 6:00，第 5~9 题 → 明天 6:00，第 10~14 题 → 后天 6:00 ...
  // 复习页用 nextReview <= now 筛选「今日待复习」，所以能正常按日复习
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const pid = `bagu-${String(i + 1).padStart(4, "0")}`;

    try {
      const problem = await prisma.problem.upsert({
        where: {
          platform_pid: {
            platform: item.platform,
            pid,
          },
        },
        update: {
          title: item.title,
          difficulty: "Medium",
          difficultyLevel: 2,
          tags: item.platform,
          answer: item.answer || null,
        },
        create: {
          platform: item.platform,
          pid,
          title: item.title,
          difficulty: "Medium",
          difficultyLevel: 2,
          tags: item.platform,
          answer: item.answer || null,
        },
      });

      const intervalDays = Math.floor(i / 20); // 每 20 题为一天
      const nextReview = getNextReviewDate(intervalDays);

      await prisma.progress.upsert({
        where: {
          userId_problemId: {
            userId: user.id,
            problemId: problem.id,
          },
        },
        update: {
          status: "Reviewing",
          nextReview,
          masteryLevel: 0,
          interval: intervalDays,
          easiness: 2.5,
        },
        create: {
          userId: user.id,
          problemId: problem.id,
          status: "Reviewing",
          masteryLevel: 0,
          interval: intervalDays,
          easiness: 2.5,
          reviewCount: 0,
          nextReview,
        },
      });

      imported++;
      if (imported % 50 === 0) {
        console.log(`已导入 ${imported}/${items.length}...`);
      }
    } catch (e) {
      console.error(`导入失败 [${item.platform}] ${item.title.slice(0, 30)}...`, e);
    }
  }

  console.log(`\n完成，共导入 ${imported} 道题`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
