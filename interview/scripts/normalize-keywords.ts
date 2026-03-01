import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 标准化关键词分隔符
 * 将中文逗号、带空格的逗号统一为英文逗号
 */
async function normalizeKeywords() {
  console.log('🔧 开始标准化关键词分隔符...\n');

  try {
    // 查找所有有关键词的记录
    const problems = await prisma.problem.findMany({
      where: {
        answerKeywords: { not: null },
      },
    });

    console.log(`📊 找到 ${problems.length} 条需要检查的记录\n`);

    let updatedCount = 0;
    let unchangedCount = 0;

    for (const problem of problems) {
      if (!problem.answerKeywords) continue;

      const original = problem.answerKeywords;

      // 标准化分隔符：
      // 1. 将中文逗号替换为英文逗号
      // 2. 将逗号后的空格去除
      // 3. 去除首尾空格
      const normalized = original
        .replace(/，/g, ',')           // 中文逗号 → 英文逗号
        .replace(/,\s+/g, ',')         // 逗号+空格 → 逗号
        .replace(/\s+,/g, ',')         // 空格+逗号 → 逗号
        .split(',')                    // 分隔成数组
        .map(k => k.trim())            // 去除每个关键词的首尾空格
        .filter(k => k)                // 去除空字符串
        .join(',');                    // 用英文逗号重新连接

      if (original !== normalized) {
        // 需要更新
        await prisma.problem.update({
          where: { id: problem.id },
          data: { answerKeywords: normalized },
        });

        console.log(`✅ [${problem.platform}] ${problem.title}`);
        console.log(`   原始: ${original}`);
        console.log(`   标准: ${normalized}\n`);
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ 标准化完成！');
    console.log(`   已更新: ${updatedCount} 条`);
    console.log(`   无需更新: ${unchangedCount} 条`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ 标准化失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

normalizeKeywords();
