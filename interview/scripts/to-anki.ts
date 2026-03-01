import * as fs from 'fs';
import * as path from 'path';

const inputFile = path.resolve(process.cwd(), '33_backup.txt');
const outputFile = path.resolve(process.cwd(), 'anki_export.txt');

function convert() {
  const raw = fs.readFileSync(inputFile, 'utf-8');
  const lines = raw.split('\n').map(l => l.trimEnd());

  // 问题行：以？或? 结尾，可以后跟括号注释 （...）
  const isQuestion = (line: string) => {
    const t = line.trim();
    return /[？?][\s（(）)]*$/.test(t) || /[？?]（[^）]*）\s*$/.test(t) || /[？?]\([^)]*\)\s*$/.test(t);
  };

  // ---- 第一步：两次扫描，先确定所有"分类名"所在行号 ----
  // 分类名特征：
  //   1. 不以？结尾
  //   2. 行内没有句号/逗号等句子标点（说明不是正文句子）
  //   3. 长度短（≤ 40 字符）
  //   4. 紧跟着（跳过空行后）一定是一道问题行，或者是另一行分类名 + 问题行
  // 策略：向后看——判断后面第一个非空行是否为问题行

  const nonEmptyLines: { idx: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) {
      nonEmptyLines.push({ idx: i, text: lines[i].trim() });
    }
  }

  const categoryLineNums = new Set<number>();
  for (let i = 0; i < nonEmptyLines.length; i++) {
    const cur = nonEmptyLines[i];
    if (isQuestion(cur.text)) continue;
    // 候选分类行：短、无句子标点
    if (
      cur.text.length <= 40 &&
      !/[。！…]/.test(cur.text) &&
      !/，.{4,}/.test(cur.text)    // 逗号后超过4字符说明是正文
    ) {
      // 向后看：后续第一个是问题行，或者后续第一个也是短行（也是分类/小节），
      // 但这类短行后面一定得有问题行
      // 简化判断：后续最近的一道题 存在 即认为这是分类行
      // 但要排除"优点/缺点"这类答案内的小标题：
      //   "优点/缺点" 前面紧接着的非空行应该是上一道题的答案（长句），而不是问题行
      const prev = nonEmptyLines[i - 1];
      if (prev && isQuestion(prev.text)) {
        // 前面紧接着是问题行 → 这不是分类，是首行答案（极少情况）
        continue;
      }
      // 看前面最近的非空行是否是长答案行（说明当前行处于答案中间，是小标题）
      if (prev && !isQuestion(prev.text) && prev.text.length > 15) {
        // 前面是长答案行，当前短行是答案小标题，不是分类名
        continue;
      }
      categoryLineNums.add(cur.idx);
    }
  }

  // ---- 第二步：按顺序生成卡片 ----
  const cards: { front: string; back: string; tags: string }[] = [];
  let currentCategory = '';
  let currentQuestion = '';
  let answerLines: string[] = [];

  const flushCard = () => {
    if (currentQuestion) {
      const back = answerLines.map(l => l.trim()).filter(l => l).join('<br>');
      cards.push({ front: currentQuestion.trim(), back, tags: currentCategory });
    }
    currentQuestion = '';
    answerLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;  // 跳过空行

    if (categoryLineNums.has(i)) {
      flushCard();
      currentCategory = trimmed;
      continue;
    }

    if (isQuestion(trimmed)) {
      flushCard();
      currentQuestion = trimmed;
      continue;
    }

    // 答案行
    if (currentQuestion) {
      answerLines.push(trimmed);
    }
  }
  flushCard();

  // ---- 第三步：写 Anki 文件 ----
  const header = [
    '#separator:tab',
    '#html:true',
    '#notetype:Basic',
    '#tags column:3',
    '',
  ].join('\n');

  const body = cards.map(c => `${c.front}\t${c.back}\t${c.tags}`).join('\n');
  fs.writeFileSync(outputFile, header + body, 'utf-8');

  // ---- 统计输出 ----
  console.log(`✅ 转换完成！`);
  console.log(`   共生成 ${cards.length} 张卡片`);
  console.log(`   输出文件: ${outputFile}\n`);

  const categoryCounts = new Map<string, number>();
  for (const c of cards) {
    categoryCounts.set(c.tags, (categoryCounts.get(c.tags) || 0) + 1);
  }
  console.log('📊 各分类卡片数：');
  for (const [cat, count] of categoryCounts.entries()) {
    console.log(`   ${cat.padEnd(30)}: ${count} 张`);
  }

  console.log('\n📌 Anki / Anymo 导入说明：');
  console.log('   1. 打开 Anki → 文件 → 导入（或 Anymo 的导入功能）');
  console.log('   2. 选择 anki_export.txt');
  console.log('   3. 分隔符选 Tab');
  console.log('   4. 勾选"允许 HTML"（答案中有 <br> 换行）');
  console.log('   5. 字段1 → 正面，字段2 → 背面，字段3 → 标签');
}

convert();
