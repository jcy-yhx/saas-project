# Phase 9 学习文档：部署 + 文档

## 本阶段目标

将项目打包为可一键部署的生产级 Docker 镜像，配置 Nginx 反向代理，建立 CI/CD 流水线，并写出完整的项目文档。这标志着项目从"本地能跑"到"可在任何服务器上运行"的最后一公里。

## 核心概念

### 1. Docker 多阶段构建（Multi-stage Build）

多阶段构建解决了两个互相矛盾的需求：
- **构建时**需要 TypeScript、tsx、Prisma CLI 等 devDependencies
- **运行时**只需要编译后的 JS 和一些 runtime deps

```dockerfile
# Stage 1: builder — 有所有 devDependencies，可以 tsc / prisma generate
FROM node:24-alpine AS builder
RUN npm ci              # 安装全部依赖
RUN npm -w packages/backend run build   # tsc 编译

# Stage 2: runner — 只装生产依赖，镜像瘦身 60%+
FROM node:24-alpine AS runner
RUN npm ci --omit=dev   # 只安装 dependencies (不含 devDependencies)
COPY --from=builder /app/packages/backend/dist packages/backend/dist
CMD ["node", "packages/backend/dist/index.js"]
```

**效果对比**：
| | 单阶段 | 多阶段 |
|---|---|---|
| 镜像大小 | ~800MB | ~250MB |
| 包含 devDeps | 是（安全风险）| 否 |
| 构建缓存 | 难以利用 | 每层独立缓存 |

### 2. Nginx 反向代理的"四合一"

Nginx 将前端静态文件、后端 API、WebSocket、上传文件统一在 80 端口对外：

```nginx
# 1. SPA 静态文件（带缓存策略）
location / {
  root /usr/share/nginx/html;
  try_files $uri $uri/ /index.html;   # SPA fallback
}
location ~* \.(js|css|png|jpg)$ {
  expires 30d;                          # 静态资源缓存 30 天
}

# 2. API 代理
location /api/ {
  proxy_pass http://backend:3000;
  proxy_set_header X-Real-IP $remote_addr;
}

# 3. WebSocket 升级
location /socket.io/ {
  proxy_pass http://backend:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 86400s;           # 长连接 24h
}

# 4. 文件上传服务
location /uploads/ {
  proxy_pass http://backend:3000;
  expires 7d;
}
```

**为什么选择 Nginx 直连而非 Node.js 静态服务？**
- Nginx 处理静态文件比 Express 快 10-50x
- 连接池复用、gzip、缓存控制都是 Nginx 的原生功能
- 生产环境的标配——面试官期望看到 Nginx

### 3. docker-entrypoint 启动脚本

容器启动时不仅要 `node index.js`，还需要先跑数据库迁移：

```sh
#!/bin/sh
set -e
echo "Running database migrations..."
npx -w packages/backend prisma migrate deploy
echo "Starting TaskFlow backend..."
exec node packages/backend/dist/index.js
```

**`exec` 的作用**：用 Node 进程替换 shell 进程。这样：
- SIGTERM 信号直接到达 Node（优雅关闭）
- 容器内只有 1 个进程（PID 1 是 node 而非 sh）

### 4. Docker Compose 的健康检查依赖

```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy   # 不等容器启动，等真正 healthy
    redis:
      condition: service_healthy

postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U taskflow"]
    interval: 5s
```

**`condition: service_healthy`** 比 `depends_on:` 默认行为更可靠——不光是"容器已启动"，而是"数据库可以接受连接了"。

### 5. GitHub Actions CI 流水线

```yaml
name: CI
on: [push, pull_request]
jobs:
  lint-and-test:
    services:
      postgres:  # CI 自动启动的 PostgreSQL
        image: postgres:16-alpine
    steps:
      - checkout
      - setup Node 24
      - npm ci
      - tsc --noEmit (前后端)
      - prisma migrate
      - npm test (28 tests)
```

每次 push/PR 都会自动运行全套检测。

### 6. 安全头（Security Headers）

```nginx
add_header X-Frame-Options "SAMEORIGIN";       # 防止点击劫持
add_header X-Content-Type-Options "nosniff";    # 防止 MIME 嗅探
add_header Referrer-Policy "strict-origin-when-cross-origin";
```

这些是 OWASP 推荐的 Web 安全头。虽然前端已经用了 Helmet，Nginx 再加一层是纵深防御。

## 关键代码走读

### 文件 1：`Dockerfile.backend`

四步骤：
1. `npm ci` + 复制源码
2. 构建 shared 包（tsc）
3. Prisma generate + 构建 backend（tsc）
4. Running stage — `npm ci --omit=dev` + move artifacts

重点：第 4 步重新 `npm ci --omit=dev` 而不是 `npm prune`。`npm prune` 会删除"当前 package.json 的依赖树中不存在的包"，但 monorepo 的 hoisting 行为可能误删。重新 install 更可靠。

### 文件 2：`nginx/nginx.conf`

- `upstream backend { server backend:3000; }` — 定义后端服务名（Docker Compose 的 DNS 解析）
- `proxy_set_header Upgrade $http_upgrade` — WebSocket 升级的核心头
- `proxy_read_timeout 86400s` — Socket.IO 需要长连接，默认 60s 会断
- `try_files $uri $uri/ /index.html` — SPA 路由的关键（任何路径都回退到 index.html）

### 文件 3：`docker-compose.prod.yml`

对比 dev compose 的关键差异：
| | dev | prod |
|---|---|---|
| 端口 | postgres:5432 暴露到宿主机 | 不暴露（内部网络）|
| 前端 | Vite dev server (:5173) | Nginx (:80) |
| 构建 | 不构建镜像 | `build: .` |
| 环境变量 | .env 文件 | 通过 env: 行传入 |
| 重启策略 | 无 | `unless-stopped` |
| 健康检查 | 无 | 所有 service 有 healthcheck |

### 文件 4：`.github/workflows/ci.yml`

CI 跑在每次 push/PR 上。关键配置：
- `services.postgres` — GitHub Actions 自动启动 PostgreSQL 容器
- `env.DATABASE_URL` — 指向 CI 的 postgres
- 步骤顺序：install → shared build → tsc check → prisma migrate → test

### 文件 5：`docker-entrypoint.sh`

生产环境启动脚本。`set -e` 保证迁移失败时整个容器退出（而不是带着旧数据库结构运行）。

## 踩坑记录

### 坑 1：`npm prune --omit=dev` 误删依赖
**现象**：Docker build 成功但运行时 `Error: Cannot find package '@paralleldrive/cuid2'`  
**原因**：`npm prune` 移除了被 hoist 到 root node_modules 的 transitive dependency  
**解决**：显式将 `@paralleldrive/cuid2` 添加到 backend package.json 的 dependencies

### 坑 2：Docker Volume 残留旧数据
**现象**：重建容器后数据库认证失败  
**原因**：之前的 postgres 容器用某个密码初始化了 volume，重建后密码不匹配  
**解决**：`docker compose down -v` 清除 volume，或使用固定的密码

### 坑 3：Nginx 502 Bad Gateway
**现象**：`curl /api/auth/login` 返回 502  
**原因**：后端容器还没启动完成（迁移正在跑）  
**解决**：nginx 配置 `proxy_next_upstream error timeout`，或增加 backend healthcheck 的 start_period

### 坑 4：Socket.IO 通过 Nginx 断连
**现象**：WebSocket 连接建立后 60 秒自动断开  
**原因**：Nginx 默认 `proxy_read_timeout 60s`，Socket.IO 的心跳间隔是 25s（2 个心跳被错过就断了）  
**解决**：`proxy_read_timeout 86400s`（24 小时）

## 延伸阅读

- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Nginx WebSocket Proxying](https://nginx.org/en/docs/http/websocket.html)
- [Docker Compose Healthcheck](https://docs.docker.com/compose/compose-file/05-services/#healthcheck)
- [GitHub Actions Service Containers](https://docs.github.com/en/actions/using-containerized-services/about-service-containers)
- [OWASP Secure Headers](https://owasp.org/www-project-secure-headers/)

---

## 新增/修改文件清单

```
根目录/
├── Dockerfile.backend                     ✅ 新增 (多阶段: ts build → node alpine)
├── Dockerfile.frontend                    ✅ 新增 (多阶段: vite build → nginx alpine)
├── docker-entrypoint.sh                   ✅ 新增 (迁移 + 启动)
├── .dockerignore                          ✅ 新增
├── nginx/nginx.conf                       ✅ 新增 (反向代理 + WS + 缓存)
├── docker-compose.prod.yml                ✅ 新增 (4 services + healthcheck)
├── .env.production.example                ✅ 新增
├── .github/workflows/ci.yml               ✅ 新增
├── README.md                              ✅ 新增 (完整文档)
└── packages/backend/package.json           ✅ 修改 (@paralleldrive/cuid2 添加)

docs/
└── phase-9-deployment.md                  ✅ 本文档
```

## 验证清单

```
[✅] docker compose -f docker-compose.prod.yml up -d (4 容器全部启动)
[✅] docker logs taskflow-backend (迁移成功 + "Server running")
[✅] curl /api/auth/register → 201 (API 正常工作)
[✅] curl /api/auth/login → 200 + JWT
[✅] curl /api/users/me → 200 (需要 Bearer token)
[✅] curl /api/workspaces → CRUD 正常
[✅] curl / → 返回 SPA HTML (Nginx 静态文件)
[✅] npm test → 28 tests passed (CI 待 GitHub 运行)
[✅] nginx 反向代理：/ → 前端, /api → 后端, /socket.io → WS
```

---

## 🎉 全部 9 个 Phase 完成！

项目从零行代码到一个可部署的完整 SaaS 应用：

- **后端**：Express + Prisma + PostgreSQL + Socket.IO + JWT + RBAC
- **前端**：React + Vite + Tailwind + @dnd-kit + React Query + Zustand
- **测试**：28 tests (单元 + 集成)
- **部署**：Docker 多阶段构建 + Nginx + CI/CD
- **文档**：10 篇学习文档 + README
