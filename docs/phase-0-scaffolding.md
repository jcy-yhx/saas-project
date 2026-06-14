# Phase 0 学习文档：项目脚手架

## 本阶段目标

从零搭建一个 monorepo 项目骨架，让后端（Express + Prisma + PostgreSQL）和前端（Vite + React + Tailwind）能同时启动并通过 HTTP 通信。这是整个项目的地基，后续所有功能都在此之上构建。

## 核心概念

### 1. npm workspaces — 原生 monorepo 方案

`monorepo`（mono repository）就是把多个相关项目放在同一个 Git 仓库里管理。npm 从 v7 开始内置了 workspaces 功能，无需额外安装 pnpm 或 Turborepo。

**根 `package.json` 的关键配置**：
```json
{
  "private": true,           // monorepo 根必须是私有包
  "workspaces": ["packages/*"] // 每个子目录自动成为一个 workspace
}
```

**工作区引用**：
- 后端引用 shared 包：`"@taskflow/shared": "*"`（`*` 表示使用本地版本）
- 运行子包脚本：`npm -w packages/backend run dev`

**为什么选 npm workspaces 而非 Turborepo？**
- 3 个包的项目不需要增量构建优化
- 零额外依赖，面试官必会的工具
- 在 StartUp 中部署更简单，少一个学习/维护成本

### 2. Prisma ORM 的工作流

Prisma 是一个 "next-generation ORM"，核心工作流三步：

```
1. schema.prisma  →  定义数据模型（手写）
2. prisma migrate  →  生成 SQL 迁移并执行（自动）
3. prisma generate →  生成类型安全的 TS 客户端（自动）
```

**schema.prisma 的三个块**：
```prisma
generator client {       // ① 代码生成器配置
  provider = "prisma-client-js"
}

datasource db {          // ② 数据库连接
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {             // ③ 数据模型定义
  id    String @id @default(cuid())
  email String @unique
  // ...
}
```

**@default(cuid())** — 用 CUID 而不是 UUID 或自增 ID：
- CUID 是 URL 安全的，不需要 URL 编码
- 包含时间戳信息，天然可排序
- 无需中心化服务即可保证唯一性
- 在分布式系统中更安全（不会像 UUID v4 那样有极低概率碰撞）

**踩坑**：Prisma 从 `prisma/` 目录向上查找 `.env` 文件。如果你的 monorepo 根目录和 `prisma/schema.prisma` 之间有不寻常的目录结构，需要把 `.env` 放到 `packages/backend/` 下。

### 3. Express 中间件的洋葱模型

Express 的中间件执行顺序是一个**洋葱圈**：

```
          ┌──────────────────────────────────┐
request → │ helmet → cors → json → logger → │ → route handler → response
          │                                  │
          │    error ← ... ← ... ← ... ←     │
          └──────────────────────────────────┘
```

每个中间件都可以：
1. 在请求到达下一层**之前**做事（如解析 body、注入 user）
2. 调用 `next()` 把控制权交给下一层
3. 在下一层返回**之后**做事（如记录日志、压缩响应）

**错误处理中间件**必须签名为 `(err, req, res, next)`，Express 通过参数数量区分普通中间件和错误处理中间件。

### 4. Vite 开发代理解决跨域

开发时前端跑在 `localhost:5173`，后端跑在 `localhost:3000`，浏览器会因为不同端口产生跨域。两种解决方式：

**方案A：CORS（后端设置）** — 生产环境必须的方式
```typescript
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
```

**方案B：Vite Proxy（开发时）** — 更推荐，因为：
- 请求路径与生产环境一致（生产用 Nginx 反向代理）
- Cookie 天然同域，不会有跨域 Cookie 问题
- 不需要在开发环境配置 CORS 白名单

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:3000',       // REST 代理
    '/socket.io': { target: 'http://localhost:3000', ws: true } // WebSocket 代理
  }
}
```

我们同时使用两种方案——CORS 保底，Vite Proxy 优化开发体验。

## 关键代码走读

### 文件 1：`packages/backend/src/app.ts` — Express 应用工厂

```typescript
export function createApp() {
  const app = express();

  // 1. 安全头：防止 XSS、点击劫持等
  app.use(helmet());

  // 2. 跨域：允许前端开发服务器访问
  app.use(cors({ origin: config.frontendUrl, credentials: true }));

  // 3. Body 解析：将 JSON body 转为 req.body 对象，限制 1MB 防攻击
  app.use(express.json({ limit: '1mb' }));

  // 4. 请求日志：每个请求打印 method + url
  app.use((req, _res, next) => {
    logger.info({ method: req.method, url: req.url }, 'incoming request');
    next();
  });

  // 5. 限流：15分钟内最多100次请求（防暴力破解和 DDoS）
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

  // 6. 健康检查：Docker/K8s 用来判断服务是否存活
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 7-8. 404 + 错误处理（链尾）
  app.use(/* 404 */);
  app.use(errorHandler);

  return app;
}
```

**为什么用工厂函数而不是直接 `const app = express()`？**
- 可以在测试中创建多个独立的 app 实例
- 避免模块级别的单例副作用
- 方便注入不同的配置

### 文件 2：`packages/backend/src/middleware/error-handler.ts` — 统一错误处理

```typescript
export function errorHandler(err, _req, res, _next) {
  // 已知的业务错误：返回对应的 HTTP 状态码和错误码
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code, message, details } });
    return;
  }

  // Prisma 的 P2002 错误 = 违反唯一约束 → 409 Conflict
  if (err.code === 'P2002') {
    res.status(409).json({ error: { code: 'CONFLICT', ... } });
    return;
  }

  // 未知错误：打日志 + 返回 500（不泄露内部细节）
  logger.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '...' } });
}
```

关键设计：
- **AppError** 是自定义异常类，包含 `statusCode` + `code` + `message` + `details`
- service 层抛出 AppError，controller 层不需要 try/catch，错误自然冒泡到这里
- 未知错误不返回 `err.stack` 给客户端（安全！）
- Prisma 特有错误被转译成标准 API 格式

### 文件 3：`packages/shared/src/schemas/index.ts` — 共享校验

这是整个 monorepo 架构的精髓——**一份 Zod schema，前后端共用**。

```typescript
// shared/src/schemas/index.ts
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

// 同时导出 TypeScript 类型
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
```

**后端使用**（中间件校验 body）：
```typescript
app.post('/api/tasks', validate(createTaskSchema), taskController.create);
```

**前端使用**（表单校验）：
```typescript
const form = useForm<CreateTaskInput>({
  resolver: zodResolver(createTaskSchema)
});
```

**好处**：
- 前后端校验规则永不漂移
- 类型和运行时校验来自同一个源
- 新增字段只需改一个地方

### 文件 4：`packages/backend/src/index.ts` — 启动引导

```typescript
async function main() {
  // 先验证数据库连接再启动 HTTP 服务
  const prisma = getPrisma();
  await prisma.$connect();  // 如果连不上，这里就抛异常退出
  logger.info('Database connected');

  const app = createApp();
  app.listen(config.port, () => { ... });
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
```

**fail-fast 原则**：数据库连不上就立刻退出，不要启动一个无法工作的服务。

### 文件 5：`packages/frontend/vite.config.ts` — 路径别名

```typescript
resolve: {
  alias: { '@': path.resolve(__dirname, './src') },
},
```
这样可以用 `import { Button } from '@/components/ui/button'` 而不是 `import { Button } from '../../../components/ui/button'`。

## 踩坑记录

### 坑 1：Prisma 找不到 .env
**现象**：`Error: Environment variable not found: DATABASE_URL`  
**原因**：Prisma 从 `prisma/` 目录向上查找 `.env`，但在 monorepo 中，根目录的 `.env` 可能不在查找路径上  
**解决**：在 `packages/backend/.env` 也放一份

### 坑 2：WSL2 中 Docker 不工作
**现象**：`docker: command not found`  
**原因**：WSL2 默认不开启 Docker Desktop 集成  
**解决**：Docker Desktop → Settings → Resources → WSL Integration → 勾选发行版 → Apply & Restart

## 延伸阅读

- [npm workspaces 官方文档](https://docs.npmjs.com/cli/v10/using-npm/workspaces)
- [Prisma Schema 参考](https://www.prisma.io/docs/orm/reference/prisma-schema-reference)
- [Express 中间件原理](https://expressjs.com/en/guide/using-middleware.html)
- [CUID 设计原理](https://github.com/ericelliott/cuid)
- [Vite 代理配置](https://vite.dev/config/server-options.html#server-proxy)

---

## 项目当前状态

```
taskflow/
├── package.json                 ✅ monorepo 根配置
├── tsconfig.base.json           ✅ 共享 TS 配置
├── docker-compose.yml           ✅ PostgreSQL + Redis
├── .env / .env.example          ✅ 环境变量模板
├── .gitignore / .prettierrc     ✅
├── packages/
│   ├── shared/                  ✅ 类型 + Zod Schema + 常量
│   ├── backend/                 ✅ Express + Prisma + 10 表迁移
│   └── frontend/                ✅ Vite + React + Tailwind
├── docs/
│   └── phase-0-scaffolding.md   ✅ 本文档
└── plan.md                      ✅ 完整实施计划
```

**验证命令**：
```bash
docker compose up -d postgres    # 启动数据库
npm run dev                      # 同时启动前后端
curl http://localhost:3000/health  # → {"status":"ok",...}
curl http://localhost:5173        # → TaskFlow 首页 HTML
```

**下一步**：Phase 1 — 认证系统（注册/登录/JWT/OAuth）
