# Phase 2 学习文档：工作区 + RBAC 权限

## 本阶段目标

实现多租户工作区管理：创建/删除工作区、基于角色的权限控制（Owner/Admin/Member）、邮件邀请成员、邀请链接接受。这是 SaaS 应用"多租户"核心能力的体现。

## 核心概念

### 1. 多租户数据隔离

SaaS 应用必须确保不同工作区（租户）之间的数据完全隔离。本项目的隔离策略：

```
User A 属于 Workspace X → 只能看到 Workspace X 的 Project/Task
User A 不是 Workspace Y 的成员 → 完全看不到 Workspace Y 的数据
```

**实现方式**：每次操作前都校验 `WorkspaceMember` 关联表。

```typescript
// 中间件层：每次请求先校验用户是否是该 workspace 的成员
const member = await prisma.workspaceMember.findUnique({
  where: { userId_workspaceId: { userId, workspaceId } },
});
if (!member) throw new ForbiddenError('...');
```

**为什么用中间件而不是在 service 层校验？**
- 集中管理：所有 workspace 操作都经过同一个鉴权点
- 不会遗漏：新加的 API 只需挂中间件，不依赖开发者记得在每个函数里写校验
- 洋葱模型：`authenticate → requireMembership → requireRole('ADMIN') → controller`
  每层职责清晰，可以独立测试和复用

### 2. RBAC (Role-Based Access Control) 权限设计

```
OWNER  (3级) — 创建工作区的用户
  ├── 可以删除工作区
  ├── 可以修改工作区设置
  ├── 可以将任何成员提升为 ADMIN
  └── 不能被移除

ADMIN  (2级) — 由 OWNER 任命
  ├── 可以邀请新成员
  ├── 可以管理成员角色（ADMIN ↔ MEMBER）
  ├── 不能删除工作区（仅 OWNER）
  └── 可以被 OWNER 移除

MEMBER (1级) — 普通成员
  ├── 可以查看任务、处理任务
  ├── 不能修改工作区设置
  └── 不能邀请成员
```

**权限层级用数字表达**：

```typescript
const ROLE_HIERARCHY = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

// 中间件工厂：requireRole('ADMIN') 表示用户角色 level >= 2
export function requireRole(minRole: string) {
  const minLevel = ROLE_HIERARCHY[minRole] ?? 0;
  return (req, _res, next) => {
    const userLevel = ROLE_HIERARCHY[req.workspaceMember.role] ?? 0;
    if (userLevel < minLevel) throw new ForbiddenError('...');
    next();
  };
}
```

这种数字层级设计的好处是易于扩展——如果要加一个 `VIEWER` 角色（level 0，只读），只需在 ROLE_HIERARCHY 中加一行。

### 3. 邀请码模式

**邀请流程**：

```
1. ADMIN 在成员页面输入邀请邮箱 → POST /api/workspaces/:id/invitations
   后端生成唯一 token (CUID)，存入 Invitation 表，7天过期

2. 受邀者通过邮件或直接链接访问 → /invitations/:token
   前端检查登录状态
   ├─ 未登录 → 存 token 到 sessionStorage，跳转登录/注册
   └─ 已登录 → 调用 POST /api/workspaces/invitations/:token/accept

3. 后端验证：
   ├─ token 是否存在？ → 否 → 400
   ├─ 是否已被接受？ → 是 → 409
   ├─ 是否已过期？ → 是 → 403
   ├─ 当前用户 email 是否匹配邀请 email？ → 否 → 403
   └─ 全部通过 → 创建 WorkspaceMember 记录，标记 invitation 为 accepted
```

**安全考量**：
- 邀请 token 用 CUID（32 字符随机字符串），不可枚举
- 邀请绑定特定 email，不是任意 link 都能接受
- 7 天过期，减少未使用 token 的累积风险
- token 接受后标记 `acceptedAt`，防止重复使用

### 4. npm workspaces 中 shared 包的使用

`@taskflow/shared` 包在 Phase 2 中扮演了关键角色——前后端共享 Zod 校验 schema：

```typescript
// shared/src/schemas/index.ts
export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
```

**后端**：Validate 中间件使用
```typescript
router.post('/', validate(createWorkspaceSchema), controller.create);
```

**前端**：React Hook Form 使用
```typescript
const form = useForm<CreateWorkspaceInput>({
  resolver: zodResolver(createWorkspaceSchema),
});
```

**好处**：
- 校验规则一次定义，前后端同步
- TypeScript 类型从 schema 自动推断，杜绝类型漂移
- 新增字段只需改 shared 包，前端表单和后端中间件同步生效

### 5. 前端路由嵌套 (Nested Routes)

React Router 7 的 Layout Route 模式：

```tsx
<Routes>
  {/* AppShell 是布局，内的 Outlet 渲染子路由 */}
  <Route element={<AppShell />}>
    <Route path="/" element={<DashboardPage />} />

    {/* WorkspacePage 又是嵌套布局 */}
    <Route path="/workspaces/:workspaceId" element={<WorkspacePage />}>
      <Route index element={<ProjectPlaceholder />} />       {/* /workspaces/:id */}
      <Route path="members" element={<MembersPage />} />     {/* /workspaces/:id/members */}
      <Route path="settings" element={<SettingsPage />} />   {/* /workspaces/:id/settings */}
    </Route>
  </Route>
</Routes>
```

这种模式的优势：
- `AppShell` 始终渲染（侧边栏 + 顶栏），页面切换不重新挂载
- `WorkspacePage` 的 tab 切换只替换 `<Outlet />` 区域
- 状态自然隔离：`useParams('workspaceId')` 在所有子路由中都可用

## 关键代码走读

### 文件 1：`packages/backend/src/middleware/authorize.ts`

RBAC 中间件的实现分两层：

**第一层 `requireWorkspaceMembership`**：从 `req.params.id` 取 workspaceId，查 `WorkspaceMember` 表确认用户是该 workspace 成员。查询结果挂载到 `req.workspaceMember`。

**第二层 `requireRole(minRole)`**：一个**工厂函数**（返回中间件），检查 `req.workspaceMember.role` 对应的数字层级是否满足要求。

这种两段式设计的好处：有些路由只需要知道"用户是成员"（如获取 workspace 详情），有些需要"用户是管理员"（如邀请成员），可以灵活组合：

```typescript
// 只读操作：只要成员即可
router.get('/:id', requireWorkspaceMembership, controller.getOne);

// 管理操作：需要 ADMIN 以上
router.patch('/:id', requireWorkspaceMembership, requireRole('ADMIN'), controller.update);

// 危险操作：只有 OWNER
router.delete('/:id', requireWorkspaceMembership, requireRole('OWNER'), controller.remove);
```

### 文件 2：`packages/backend/src/services/workspace.service.ts`

130 行的 service 层，覆盖全部业务逻辑。值得关注的几个设计：

**`toSlug()` + `ensureUniqueSlug()`**：将 workspace 名称转为 URL 友好的 slug（如 "Acme Corp" → "acme-corp"），并自动追加序号防止重复。

**`createWorkspace()` 内的嵌套创建**：
```typescript
const workspace = await prisma.workspace.create({
  data: {
    name, slug, description,
    members: { create: { userId, role: 'OWNER' } },  // ← 一条语句创建 workspace + 首个成员
  },
  include: { members: { ... } },  // ← 同时返回成员信息
});
```
Prisma 的嵌套写入让关联创建在一个事务内完成。

**`listWorkspaces()` 的子查询统计**：
```typescript
include: { _count: { select: { projects: true, members: true } } }
```
一次查询返回每个 workspace 的项目数和成员数，用于 Dashboard 卡片展示。

### 文件 3：`packages/frontend/src/components/layout/AppShell.tsx`

应用壳布局，固定结构：
```
┌──────────────────────────────────────────┐
│  Sidebar (60px)    │  TopBar (12px)      │
│  - Dashboard link  │  - Toggle sidebar   │
│  - Workspace list  │  - User email       │
│  - New Workspace   │  - Profile / Logout  │
│                    ├─────────────────────│
│                    │  <Outlet />         │
│                    │  (page content)     │
└────────────────────┴─────────────────────┘
```

`useWorkspaces()` 查询的 workspace 列表直接渲染为侧边栏导航项，每个项带角色颜色点，点击跳转到 workspace 详情。

### 文件 4：`packages/frontend/src/pages/MembersPage.tsx`

成员管理页面展示：
- 每个成员的姓名、email、角色徽章
- OWNER 只能看不能改
- ADMIN 可以改 MEMBER 的角色（下拉选择框）或移除
- 当前登录用户的信息标注

**UI 决策**：不显示 ADMIN 用户对其他 ADMIN 的操作按钮（只有 OWNER 可以改 ADMIN 的角色），后端也有备防。

### 文件 5：`packages/frontend/src/api/workspaces.ts`

React Query 的 hooks 模式体现了几个最佳实践：

- **Query Key 分层**：`['workspaces', 'list']`、`['workspaces', 'detail', id]`、`['workspaces', 'members', id]` — 精确定位每个缓存，方便点对点 invalidate
- **Optimistic 不在这里**：成员角色变更用了 `onSuccess: invalidateQueries`，等服务器确认后再刷新。对于低频操作（改角色、移除成员），乐观更新收益不大，保守策略更安全
- **enabled 条件**：`useWorkspace(id)` 和 `useMembers(id)` 都用了 `enabled: !!id`，避免 URL 参数为空时发出无效请求

## 踩坑记录

### 坑 1：Express 5 的 params 类型
**现象**：`req.params.id` 的类型是 `string | string[]`，传给 service 报 TS 错误  
**原因**：Express 5 的 `@types/express@5` 在处理 `/:id/members/:userId` 这种多参数路由时，类型推导保守  
**解决**：用 `pid(req, 'id')` 辅助函数做 `as string` 断言，或使用 `req.params.id as string`

### 坑 2：Prisma 嵌套查询的 `_count` 展开
**现象**：`include: { _count: { select: { ... } } }` 返回的数据在序列化后 `_count` 字段丢失  
**原因**：`JSON.stringify` 默认行为没问题，但 `res.json()` 的序列化有特殊处理  
**解决**：在 `listWorkspaces()` 的 map 中将 `_count` 展平为顶层字段 `projectCount`、`memberCount`

### 坑 3：React Router 嵌套路由的 index 路由
**现象**：访问 `/workspaces/:id` 时 WorkspacePage 的 Outlet 中没有内容  
**原因**：缺少 `<Route index element={...} />`——`index` 是匹配父路径本身的子路由  
**解决**：`<Route index element={<ProjectPlaceholder />} />`

## 延伸阅读

- [RBAC 设计模式](https://auth0.com/docs/manage-users/access-control/rbac)
- [Prisma 嵌套写入](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations)
- [React Router 7 Layout Routes](https://reactrouter.com/start/library/routing#layout-routes)
- [TanStack Query Dependent Queries](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries)
- [多租户架构模式](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models)

---

## 新增/修改文件清单

```
packages/backend/
├── src/
│   ├── middleware/authorize.ts            ✅ 新增 — RBAC 中间件
│   ├── services/workspace.service.ts      ✅ 新增 — 工作区业务逻辑
│   ├── controllers/workspace.controller.ts ✅ 新增 — 工作区控制器
│   ├── routes/workspace.routes.ts         ✅ 新增 — /api/workspaces/* 路由
│   ├── types/express.d.ts                 ✅ 修改 — 添加 workspaceMember 类型
│   └── app.ts                             ✅ 修改 — 挂载 workspaceRoutes

packages/frontend/
├── src/
│   ├── api/workspaces.ts                  ✅ 新增 — 工作区 API hooks
│   ├── components/
│   │   ├── layout/AppShell.tsx            ✅ 新增 — 应用壳布局
│   │   ├── workspace/WorkspaceCard.tsx    ✅ 新增 — 侧边栏工作区卡片
│   │   ├── workspace/WorkspaceForm.tsx    ✅ 新增 — 创建工作区对话框
│   │   └── workspace/InviteDialog.tsx     ✅ 新增 — 邀请成员对话框
│   ├── pages/
│   │   ├── DashboardPage.tsx              ✅ 修改 — 工作区列表 + 删除
│   │   ├── WorkspacePage.tsx              ✅ 新增 — 工作区主页（tab 导航）
│   │   ├── MembersPage.tsx                ✅ 新增 — 成员管理
│   │   ├── WorkspaceSettingsPage.tsx      ✅ 新增 — 工作区设置
│   │   ├── AcceptInvitationPage.tsx       ✅ 新增 — 接受邀请
│   │   ├── ProfilePage.tsx                ✅ 新增 — 用户信息
│   │   └── ProjectPlaceholder.tsx         ✅ 新增 — 占位页
│   └── App.tsx                            ✅ 修改 — 完整路由配置

docs/
└── phase-2-workspaces.md                  ✅ 本文档
```

## API 端点总结

```
POST   /api/workspaces                          → 创建工作区（创建者自动成为 OWNER）
GET    /api/workspaces                          → 列表用户的工作区（含角色、项目数、成员数）
GET    /api/workspaces/:id                      → 详情（需成员身份）
PATCH  /api/workspaces/:id                      → 更新设置（需 ADMIN+）
DELETE /api/workspaces/:id                      → 删除（需 OWNER，级联删除所有数据）
GET    /api/workspaces/:id/members              → 成员列表（需成员身份）
PATCH  /api/workspaces/:id/members/:userId      → 修改角色（需 ADMIN+）
DELETE /api/workspaces/:id/members/:userId      → 移除成员（需 ADMIN+，不能移除 OWNER）
POST   /api/workspaces/:id/invitations          → 邀请（需 ADMIN+）
GET    /api/workspaces/:id/invitations          → 待处理邀请列表（需 ADMIN+）
POST   /api/workspaces/invitations/:token/accept → 接受邀请（需登录）
```

**下一步**：Phase 3 — 看板 + 任务管理（Project、Task、Kanban 拖拽）
