# 关键词提取脚本使用说明

## 功能描述

这个脚本会自动：
1. **清理重复记录**：如果数据库中有相同 `pid` 的重复记录（不同 platform），会智能合并
2. **提取关键词**：使用 Claude AI 从答案中提取核心关键词
3. **更新数据库**：自动填充所有 `answerKeywords` 字段

## 前置要求

需要一个 Anthropic API Key（Claude API 访问密钥）

### 获取 API Key

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册/登录账号
3. 进入 **API Keys** 页面
4. 点击 **Create Key** 创建新密钥
5. 复制密钥（形如 `sk-ant-...`）

## 使用方法

### 方式一：临时设置（推荐）

```bash
ANTHROPIC_API_KEY=sk-sssaicode-cb7e8bf5069ff43655ec89148b477a46345f18e122a7cab90846ad98373d2e2a npm run extract:keywords
```

### 方式二：环境变量文件

1. 在项目根目录创建 `.env.local` 文件：
```bash
ANTHROPIC_API_KEY=your-api-key-here
```

2. 运行脚本：
```bash
npm run extract:keywords
```

### 方式三：系统环境变量

```bash
export ANTHROPIC_API_KEY=your-api-key-here
npm run extract:keywords
```

## 执行流程

脚本会按以下步骤执行：

### 1. 清理重复记录
```
🧹 清理重复记录...

  发现重复 PID: bagu-0177 (2 条记录)
    保留: [计算机网络] http中Get和post请求的区别？
    删除: [计算机基础] http中Get和post请求的区别？

✅ 重复记录清理完成
```

### 2. 提取关键词
```
📊 找到 180 条需要提取关键词的记录

[1/180] 处理: http中Get和post请求的区别？
  分类: 计算机网络
  ✅ 关键词: 请求方式,参数传递,缓存机制,安全性,幂等性

[2/180] 处理: https加密流程？
  分类: 计算机网络
  ✅ 关键词: SSL/TLS,对称加密,非对称加密,数字证书,握手过程
```

### 3. 完成统计
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 处理完成！
   成功: 178 条
   失败: 2 条
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 重复记录处理规则

当发现相同 `pid` 的多条记录时，会按以下优先级选择保留：

1. ✅ **有关键词** 优先于 无关键词
2. ✅ **原始分类**（如"计算机网络"）优先于 "计算机基础"
3. ✅ **创建时间早** 优先于 创建时间晚

被删除的记录及其所有关联数据（Progress、Submission）都会被清理。

## 关键词提取标准

AI 会根据以下标准提取关键词：

- ✅ 回答问题时必须涵盖的核心要点
- ✅ 简洁的技术术语（2-6 个字）
- ✅ 3-8 个最重要的关键词
- ✅ 技术概念、核心步骤、关键机制

示例：

| 问题 | 关键词示例 |
|------|------------|
| HTTP 和 HTTPS 的区别？ | SSL/TLS,加密传输,端口号,证书验证,安全性 |
| JVM 垃圾回收算法？ | 标记清除,复制算法,标记整理,分代收集,GC Roots |
| Redis 持久化方式？ | RDB,AOF,快照,增量日志,混合持久化 |

## 费用估算

- 使用模型：`claude-3-5-haiku-20241022`（最便宜的模型）
- 预估费用：每条记录约 $0.0005 - $0.001
- 处理 200 条记录：约 $0.10 - $0.20

## 注意事项

⚠️ **重要提示**：
1. 脚本会直接修改数据库，建议先备份
2. 重复记录会被永久删除，无法恢复
3. API 调用有速率限制，脚本已添加 1 秒延迟
4. 如果中途中断，可以重新运行（会跳过已有关键词的记录）

## 备份数据库

运行脚本前建议备份：

```bash
# 备份 SQLite 数据库
cp prisma/dev.db prisma/dev.db.backup

# 如需恢复
cp prisma/dev.db.backup prisma/dev.db
```

## 故障排查

### 问题：`ANTHROPIC_API_KEY 未设置`
```
❌ 错误：请设置 ANTHROPIC_API_KEY 环境变量
```
**解决**：按照上面的方法设置 API Key

### 问题：API 调用失败
```
❌ API 调用失败: insufficient_quota
```
**解决**：检查 Anthropic 账户余额或配额

### 问题：网络连接失败
```
❌ 错误: fetch failed
```
**解决**：检查网络连接，确保可以访问 api.anthropic.com

## 验证结果

脚本执行完成后，可以验证：

### 1. 使用 Prisma Studio 检查
```bash
npx prisma studio
```
打开 Problem 表，查看 `answerKeywords` 字段是否已填充

### 2. 使用 SQL 查询
```bash
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM Problem WHERE answerKeywords IS NOT NULL AND answerKeywords != '';"
```

### 3. 在应用中查看
访问 `/review` 页面，查看答案后应能看到关键词展示

## 技术细节

- **脚本位置**：`scripts/extract-keywords.ts`
- **使用模型**：Claude 3.5 Haiku
- **并发控制**：串行处理，每次请求间隔 1 秒
- **错误处理**：单条失败不影响其他记录继续处理
- **数据库操作**：使用 Prisma ORM
