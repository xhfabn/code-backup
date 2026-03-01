import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 从环境变量获取 API key，如果没有则提示用户
const LLM_API_KEY = process.env.LLM_API_KEY;

if (!LLM_API_KEY) {
  console.error('❌ 错误：请设置 LLM_API_KEY 环境变量');
  console.log('\n使用方法:');
  console.log('LLM_API_KEY=your-api-key npm run extract:keywords\n');
  process.exit(1);
}

const client = new OpenAI({
  apiKey: LLM_API_KEY,
  baseURL: 'https://llm-gateway.momenta.works/v1',
});

/**
 * 使用 Claude 从答案中提取关键词
 */
async function extractKeywords(question: string, answer: string): Promise<string> {
  const prompt = `你是一个专业的技术面试助手。请根据以下八股文问题及其答案，提炼出能够概括答案核心内容的关键词短语。

**核心目标：** 看到这些关键词就能回忆起完整答案的要点，起到"记忆锚点"的作用。

**要求：**
1. 关键词不是简单的术语罗列，而是对答案要点的精炼概括
2. 每个关键词/短语控制在 2-10 个字，可以是短句形式（如"红黑树优化链表"、"头插法导致环"）
3. 提取 3-5 个，按答案的逻辑顺序排列
4. 覆盖答案的主要层次：定义/是什么 → 原理/为什么 → 应用/怎么用
5. 只输出关键词，用英文逗号分隔，不要有其他解释
6. 格式：关键词1,关键词2,关键词3（英文逗号，无空格）

**问题：**
${question}

**答案：**
${answer}

**请提炼概括性关键词（只输出关键词，逗号分隔）：**`;

  try {
    const response = await client.chat.completions.create({
      model: 'claude-haiku-4.5',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const keywords = response.choices[0].message.content?.trim() ?? '';
    return keywords;
  } catch (error) {
    console.error('API 调用失败:', error);
    throw error;
  }
}

/**
 * 清理重复记录
 */
async function cleanupDuplicates() {
  console.log('🧹 清理重复记录...\n');

  // 查找所有重复的 pid
  const allProblems = await prisma.problem.findMany({
    orderBy: { id: 'asc' },
  });

  // 按 pid 分组
  const pidGroups = new Map<string, typeof allProblems>();
  for (const problem of allProblems) {
    const existing = pidGroups.get(problem.pid) || [];
    existing.push(problem);
    pidGroups.set(problem.pid, existing);
  }

  // 处理重复记录
  for (const [pid, problems] of pidGroups.entries()) {
    if (problems.length > 1) {
      console.log(`  发现重复 PID: ${pid} (${problems.length} 条记录)`);

      // 按优先级选择保留哪条记录
      // 1. 优先保留有关键词的
      // 2. 优先保留原始 platform（非"计算机基础"）
      // 3. 优先保留较旧的记录
      const sorted = problems.sort((a, b) => {
        if (a.answerKeywords && !b.answerKeywords) return -1;
        if (!a.answerKeywords && b.answerKeywords) return 1;
        if (a.platform !== '计算机基础' && b.platform === '计算机基础') return -1;
        if (a.platform === '计算机基础' && b.platform !== '计算机基础') return 1;
        return a.id.localeCompare(b.id);
      });

      const keepRecord = sorted[0];
      const deleteRecords = sorted.slice(1);

      console.log(`    保留: [${keepRecord.platform}] ${keepRecord.title}`);
      if (keepRecord.answerKeywords) {
        console.log(`      关键词: ${keepRecord.answerKeywords}`);
      }

      // 删除重复记录及其关联数据
      for (const record of deleteRecords) {
        console.log(`    删除: [${record.platform}] ${record.title}`);

        // 先删除关联的 Progress 和 Submission
        const progresses = await prisma.progress.findMany({
          where: { problemId: record.id },
          include: { submissions: true },
        });

        for (const progress of progresses) {
          // 删除 submissions
          await prisma.submission.deleteMany({
            where: { progressId: progress.id },
          });
          // 删除 progress
          await prisma.progress.delete({
            where: { id: progress.id },
          });
        }

        // 删除 problem
        await prisma.problem.delete({
          where: { id: record.id },
        });
      }

      console.log();
    }
  }

  console.log('✅ 重复记录清理完成\n');
}

/**
 * 主函数：提取并更新所有关键词
 */
async function main() {
  console.log('🚀 开始提取答案关键词...\n');

  try {
    // 1. 清理重复记录
    await cleanupDuplicates();

    // 2. 查找所有有答案的记录（全部重新提取）
    const problems = await prisma.problem.findMany({
      where: {
        answer: { not: null },
      },
      orderBy: { id: 'asc' },
    });

    console.log(`📊 找到 ${problems.length} 条需要提取关键词的记录\n`);

    if (problems.length === 0) {
      console.log('✅ 所有记录都已有关键词！');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    // 3. 逐个处理
    for (let i = 0; i < problems.length; i++) {
      const problem = problems[i];
      const progress = `[${i + 1}/${problems.length}]`;

      try {
        console.log(`${progress} 处理: ${problem.title}`);
        console.log(`  分类: ${problem.platform}`);

        if (!problem.answer) {
          console.log('  ⚠️  跳过：无答案内容\n');
          continue;
        }

        // 提取关键词
        const keywords = await extractKeywords(problem.title, problem.answer);

        if (keywords) {
          // 更新数据库
          await prisma.problem.update({
            where: { id: problem.id },
            data: { answerKeywords: keywords },
          });

          console.log(`  ✅ 关键词: ${keywords}\n`);
          successCount++;
        } else {
          console.log(`  ⚠️  未能提取关键词\n`);
          failCount++;
        }

        // 添加小延迟避免 API 限流
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`  ❌ 错误: ${error.message}\n`);
        failCount++;
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✨ 处理完成！`);
    console.log(`   成功: ${successCount} 条`);
    console.log(`   失败: ${failCount} 条`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ 脚本执行失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
