/**
 * 格式化 33.txt，确保：
 * 1. 每个 platform 行（如 JavaSE、MySQL、Redis 等）前后有空行
 * 2. 每个题目行（以 ? 或 ？ 结尾）前有空行（与上一题的答案隔开）
 * 3. 不会产生连续的多余空行（最多保留一个空行）
 */
import * as fs from "fs";
import * as path from "path";

const PLATFORM_MAX_LEN = 50;

function isPlatformLine(trimmed: string): boolean {
  if (trimmed === "") return false;
  if (trimmed.endsWith("?") || trimmed.endsWith("？")) return false;
  if (trimmed.length > PLATFORM_MAX_LEN) return false;
  // 纯英文字母、数字、中文组成，无空格无标点
  return /^[A-Za-z0-9\u4e00-\u9fff]+$/.test(trimmed);
}

function isQuestionLine(trimmed: string): boolean {
  return trimmed.endsWith("?") || trimmed.endsWith("？");
}

function formatBagu(content: string): string {
  const lines = content.split(/\r?\n/);
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // 空行：保留（后面统一合并连续空行）
    if (trimmed === "") {
      result.push("");
      continue;
    }

    // 辅助：上一个非空行的末尾是否有空行
    const lastLine = result.length > 0 ? result[result.length - 1].trim() : "";
    const prevIsBlank = result.length === 0 || lastLine === "";

    // Platform 行：前后确保有空行
    if (prevIsBlank && isPlatformLine(trimmed)) {
      if (!prevIsBlank) {
        result.push("");
      }
      result.push(lines[i]);
      result.push("");
      continue;
    }

    // 题目行（以 ? 或 ？ 结尾）：前面确保有空行
    if (isQuestionLine(trimmed)) {
      // 不管前面是什么，只要前面一行不是空行就加空行
      if (!prevIsBlank) {
        result.push("");
      }
      result.push(lines[i]);
      continue;
    }

    // 普通答案行：直接加
    result.push(lines[i]);
  }

  // 清理：去除首尾空行，合并连续空行为最多一个
  let output = result.join("\n");
  // 合并3个及以上连续换行为2个（即一个空行）
  output = output.replace(/\n{3,}/g, "\n\n");
  // 去除首尾空白
  output = output.trim() + "\n";

  return output;
}

function main() {
  const args = process.argv.slice(2);
  const inputPath = args[0] || path.join(process.cwd(), "33.txt");

  if (!fs.existsSync(inputPath)) {
    console.error("文件不存在:", inputPath);
    process.exit(1);
  }

  const content = fs.readFileSync(inputPath, "utf-8");
  const originalLines = content.split(/\r?\n/);

  const formatted = formatBagu(content);
  const formattedLines = formatted.split(/\r?\n/);

  console.log(`原始行数: ${originalLines.length}`);
  console.log(`格式化后行数: ${formattedLines.length}`);

  // 统计题目数
  let questionCount = 0;
  for (const line of formattedLines) {
    const t = line.trim();
    if (t.endsWith("?") || t.endsWith("？")) {
      questionCount++;
    }
  }
  console.log(`题目总数: ${questionCount}`);

  // 写回文件
  fs.writeFileSync(inputPath, formatted, "utf-8");
  console.log("已格式化并写回:", inputPath);
}

main();
