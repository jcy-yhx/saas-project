# Phase 7 学习文档：全文搜索

## 本阶段目标

使用 PostgreSQL 原生全文搜索能力（tsvector + GIN 索引）实现跨任务搜索，配合 Cmd+K 命令面板提供即时搜索体验。展示关系型数据库在全文检索场景的实战能力。

## 核心概念

### 1. PostgreSQL 全文搜索原理

PostgreSQL 的全文搜索依赖三个核心概念：

| 概念 | 说明 |
|------|------|
| **tsvector** | 预处理的文本向量（分词 + 去停词 + 词干）|
| **tsquery** | 用户查询转换后的搜索条件 |
| **GIN index** | 倒排索引，将词映射到包含该词的行 |

**流程图**：
```
写入时 (GENERATED ALWAYS):
  title: "Setup PostgreSQL database"
    → to_tsvector('english', title)
    → 'databas':3 'postgresql':2 'setup':1   ← 词干已归一化

读取时 (搜索):
  query: "database"
    → to_tsquery('english', 'database:*')
    → 'databas':*   ← 前缀匹配

  tsvector @@ tsquery  → true (匹配!)
  ts_rank(tsvector, tsquery)  → 0.xxx (相关性分数)
  ts_headline(...)  → "Setup <mark>PostgreSQL database</mark>" (高亮)
```

**GENERATED ALWAYS ... STORED** 的含义：
- `GENERATED ALWAYS` — 列值由表达式自动计算（不能手动写入）
- `STORED` — 计算结果持久化到磁盘（vs `VIRTUAL`，每次计算）
- 当 `title` 或 `description` 更新时，`searchVector` 自动重新生成

### 2. 加权 tsvector

不同字段对搜索的贡献不同：

```sql
setweight(to_tsvector('english', coalesce(title, '')), 'A') ||  -- 标题权重 A
setweight(to_tsvector('english', coalesce(description, '')), 'B')  -- 描述权重 B
```

权重范围：A (1.0) > B (0.4) > C (0.2) > D (0.1)。标题匹配比描述匹配高 2.5 倍。`ts_rank` 自动利用权重计算相关性。

### 3. 查询格式化（Query Formatting）

用户输入 "setup database" 需要转为 PostgreSQL 能理解的 tsquery：

```typescript
function formatQuery(q: string): string {
  return q
    .replace(/[^\w\s]/g, ' ')   // 去掉特殊字符
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word}:*`)  // 前缀匹配
    .join(' & ');                // AND 连接
}
// "setup database" → "setup:* & database:*"
```

**为什么用 `:*` 前缀匹配？**
- 用户输入 "database" → 匹配 "database", "databases", "database-driven"
- 用户输入 "set" → 匹配 "setup", "settings", "set"（输入更少也有效）
- `&` (AND) 连接：两个词都必须出现（比 `|` OR 更精确）

### 4. 高亮片段（ts_headline）

```sql
ts_headline('english', coalesce(title, ''), to_tsquery('english', $q),
  'MaxWords=40, MinWords=15, StartSel=<mark>, StopSel=</mark>')
```

参数解释：
- `MaxWords=40` — 最多 40 个词
- `MinWords=15` — 最少 15 个词（不够从上下文补齐）
- `StartSel/StopSel` — 高亮标记（用 HTML `<mark>` 标签）

### 5. 为什么不用 LIKE/ILIKE？

| | LIKE | tsvector |
|---|---|---|
| 索引 | B-tree（前缀匹配才能用）| GIN（全文搜索专用）|
| 分词 | 无（逐字符匹配）| 有（词干提取 + 停词去除）|
| 相关性 | 无 | ts_rank 排序 |
| 性能 | O(n) 全表扫描 | O(log n) 索引查找 |
| 语言感知 | 无 | 多语言支持（english, simple, ...）|

**关键差异**：`ILIKE '%database%'` 需要扫描整个表，`tsvector @@ to_tsquery('database:*')` 使用 GIN 索引直接定位。

### 6. Cmd+K 命令面板模式

`SearchCommand` 组件实现了类似 Linear/Superhuman 的 Cmd+K 搜索面板：

```
┌─────────────────────────────────┐
│ 🔍 Search tasks...        [esc] │
├─────────────────────────────────┤
│ Setup PostgreSQL database  TODO │
│ Setup <mark>PostgreSQL</mark>…  │
│ SearchTest                      │
├─────────────────────────────────┤
│ ↑↓ Navigate  ↵ Open  Esc Close │
└─────────────────────────────────┘
```

**关键 UX 细节**：
- `Cmd+K` / `Ctrl+K` 全局快捷键
- 250ms 防抖搜索（避免每次按键都发请求）
- 上下箭头导航 + 回车打开
- 鼠标 hover 更新选中项
- `<mark>` 标签黄色高亮（CSS 自定义）

## 关键代码走读

### 文件 1：`packages/backend/src/services/search.service.ts`

核心 SQL 构建逻辑：

```typescript
const searchSql = `
  SELECT t.*, p."name" as "projectName", p."workspaceId",
    ts_headline(...) as headline,
    ts_rank(t."searchVector", to_tsquery($q)) as rank
  FROM "Task" t JOIN "Project" p ON t."projectId" = p.id
  WHERE p."workspaceId" = $1
    AND t."searchVector" @@ to_tsquery($q)
  ORDER BY rank DESC
  LIMIT $lim OFFSET $off
`;
```

- JOIN Project 获取 projectName 和 workspaceId（搜索结果展示用）
- `@@` 是 tsvector 匹配操作符
- 按 rank 降序，最相关的结果最先返回
- 安全：所有用户输入通过 `$1, $2, ...` 参数化，防止 SQL 注入

### 文件 2：`prisma/migrations/20260629084334_add_search_vector/migration.sql`

Prisma 的 raw SQL 迁移——Prisma 不原生支持 tsvector，但支持裸 SQL 迁移。

### 文件 3：`packages/frontend/src/components/common/SearchCommand.tsx`

120 行的命令面板组件，集成了：
- 全局键盘快捷键监听
- 防抖搜索（250ms）
- 键盘导航（ArrowDown/Up + Enter + Esc）
- `<mark>` HTML 渲染（黄色高亮）
- 状态徽章（TODO/IN_PROGRESS/DONE 颜色区分）

## 踩坑记录

### 坑 1：Prisma `$queryRawUnsafe` 的参数绑定
**现象**：`ts_headline(..., to_tsquery('english', $q), ...)` 中 `$q` 被 Prisma 解析为列引用而非参数  
**原因**：`$1, $2` 是 Prisma 的参数占位符，但在 `'english'` 字符串后面的 `$q` 被 SQL 解析器误解  
**解决**：在 SQL 中统一使用 `$1, $2, ...` 数字占位符

### 坑 2：GENERATED ALWAYS 列不能被 Prisma 管理
**现象**：添加 `Unsupported("tsvector")` 后 Prisma 尝试 ALTER TABLE 添加列，报错 "is a generated column"  
**原因**：Prisma 不知道这个列是生成的  
**解决**：不添加到 Prisma schema，只保留在 raw SQL 迁移中

## 延伸阅读

- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Prisma Raw SQL Queries](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries)
- [GIN Index Internals](https://www.postgresql.org/docs/current/gin-intro.html)
- [Building a Command Palette in React](https://cmdk.paco.me/)

---

## 新增/修改文件清单

```
packages/backend/
├── prisma/migrations/20260629084334_add_search_vector/migration.sql ✅ 新增
├── src/
│   ├── services/search.service.ts           ✅ 新增 ($queryRawUnsafe + tsvector)
│   ├── controllers/search.controller.ts     ✅ 新增
│   ├── routes/search.routes.ts              ✅ 新增
│   └── app.ts                               ✅ 修改 (/api/search 路由)

packages/frontend/
├── src/
│   ├── api/search.ts                        ✅ 新增
│   ├── components/common/SearchCommand.tsx  ✅ 新增 (Cmd+K palette)
│   └── components/layout/AppShell.tsx       ✅ 修改 (search button + SearchCommand)

docs/
└── phase-7-search.md                        ✅ 本文档
```

## API 端点

```
GET /api/search?workspaceId=xxx&q=database&status=TODO&priority=HIGH
→ { data: [{ id, title, status, priority, projectName, workspaceId, headline }], meta: { total, page, pageSize } }
```

## 测试结果

```
Search "database"     → 2 results (Setup PostgreSQL database, Design database schema)
Search "api"          → 1 result, headline with <mark>API</mark> highlight
Search + status filter → filter works
GIN index used       → EXPLAIN confirms index scan
```

**下一步**：Phase 8 — 测试 + UX 打磨
