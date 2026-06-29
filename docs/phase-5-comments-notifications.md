# Phase 5 学习文档：评论 + 通知系统

## 本阶段目标

为任务添加评论讨论功能和全局通知系统。用户可以在任务详情中发表评论，系统自动为相关变更创建通知（评论、任务状态变更、任务指派等）。

## 核心概念

### 1. 通知系统的"拉取 + 推送"混合模式

纯 WebSocket 推送和纯轮询各有缺点：

| 方式 | 优点 | 缺点 |
|------|------|------|
| WebSocket 推送 | 实时 | 连接断开期间丢失事件 |
| 轮询 | 可靠，不丢事件 | 延迟高，浪费带宽 |

**本项目采用混合模式**：
- **Socket 事件**（`comment:created`）→ 立即 invalidate 缓存（实时性）
- **轮询**（`refetchInterval: 15_000`）→ 兜底获取最新计数（可靠性）

```typescript
// api/notifications.ts
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.count(),
    queryFn: async () => { ... },
    refetchInterval: 15_000,  // 每 15 秒兜底轮询
  });
}
```

### 2. 通知自动创建的"副作用"模式

通知不是"谁调用谁创建"，而是作为 mutation 的副作用自动触发：

```
用户 A 发表评论 → comment.controller.create
  ├── 1. 创建评论（主要业务）
  ├── 2. 查询任务 → 获取所有 assignees + creator
  ├── 3. 排除评论者自己
  └── 4. notifyUsers(剩余用户, 'COMMENT_ADDED', ...)  // 副作用
```

```typescript
// comment.controller.ts
const notifyIds = new Set(task.assignees.map(a => a.userId));
if (task.creatorId !== req.user!.id) notifyIds.add(task.creatorId);
notifyIds.delete(req.user!.id);  // 不给自己发通知

await notificationService.notifyUsers(
  Array.from(notifyIds),
  'COMMENT_ADDED',
  'New comment',
  `${req.user?.email} commented on "${task.title}"`,
  { taskId, commentId: comment.id },
);
```

**关键设计决策**：
- 通知创建在 controller 层（不在 service 层），因为它是 HTTP 副作用的自然延伸
- `notifyUsers` 使用 Prisma `createMany`，一次 SQL 写入多条通知记录
- 任务指派（assignUser）时也会触发通知 → 未来可在 Phase 8 补充

### 3. 评论的"只允许作者编辑"模式

```typescript
// comment.service.ts
export async function updateComment(id: string, userId: string, input: UpdateCommentInput) {
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) throw new NotFoundError('Comment');

  // Only the author can edit their own comment
  if (comment.userId !== userId) {
    throw new NotFoundError('Comment'); // 404, not 403 (don't leak existence)
  }
  // ...
}
```

**为什么返回 404 而非 403？**
- 403 "Forbidden" 暴露了一个事实：此评论存在但不是你的
- 404 "Not Found" 不泄露任何信息（攻击者不知道评论是否存在）
- 这是 API 安全设计的一个基本实践

### 4. React Query 的 `refetchInterval` vs WebSocket

两套缓存更新体系协同工作：

```
看板任务    → WebSocket (task:created/moved/updated/deleted) → 立即 invalidate
评论        → WebSocket (comment:created)                     → 立即 invalidate
通知计数    → 轮询 (15s) + WebSocket (notification:new)       → 双重保障
通知列表    → 轮询 (30s)                                       → 后端拉取
```

### 5. UI 组件设计模式

**CommentSection 结构**：
```
CommentSection (容器)
├── CommentForm (textarea + send button)
└── CommentList
    └── CommentItem[] (hover 可见编辑/删除按钮)
        ├── 查看模式: 头像 + 名字 + 时间 + 内容
        └── 编辑模式: textarea + Check/X 按钮
```

**NotificationBell 模式**：
- 使用 `useRef` + `mousedown` 事件监听实现"点击外部关闭"
- 显示最近 5 条通知 + "View all" 链接
- 未读数 badge（红色圆点，>9 显示 "9+"）
- "Mark all read" 一键全部标记已读

## 关键代码走读

### 文件 1：`packages/backend/src/services/notification.service.ts`

**`notifyUsers`** 批量创建通知——一次 `createMany` 写入所有记录，避免 N+1 问题。

**`markAsRead`** 使用 `updateMany` 确保原子性和正确的 userId 匹配：
```typescript
await prisma.notification.updateMany({
  where: { id, userId },  // 双重条件，确保用户只能标记自己的通知
  data: { read: true },
});
```

### 文件 2：`packages/backend/src/middleware/authorize.ts` 的变更

Phase 5 新增了从 `taskId` 和 `commentId` 反查 workspace 的能力：

```
req.params.commentId → Comment → Task → Project → Workspace → checkMembership
req.params.taskId    → Task    → Project → Workspace → checkMembership
req.params.projectId → Project → Workspace → checkMembership
req.params.id        → Workspace → checkMembership (direct)
```

链式反查虽然多 1-2 次 DB 查询，但保证了所有嵌套路由的权限一致性。

### 文件 3：`packages/frontend/src/components/comment/CommentSection.tsx`

标准的 React Query mutation 模式：`useCreateComment` 成功后 invalidate `commentKeys.byTask(taskId)` → 评论列表自动刷新。

### 文件 4：`packages/frontend/src/components/notification/NotificationBell.tsx`

两个核心交互：
1. 点击通知 → 标记为已读（`markReadMut.mutate(n.id)`）
2. "Mark all read" → 批量标记（`markAllReadMut.mutate()`）

在 `TaskDetailSheet` 中也有评论的实时功能（Socket.IO）。

## 踩坑记录

### 坑 1：`Set<string>` 迭代
**现象**：`for (const uid of notifyIds)` 在 `notifyIds` 是 `Set<string>` 时正常运行  
**注意**：`Set` 支持 `for...of` 迭代，返回的是值而非 `[key, value]` 对

### 坑 2：Not Found vs Forbidden
**现象**：测试中攻击者枚举评论 ID 时返回 403，暴露了评论存在  
**解决**：将评论编辑/删除权限检查改为返回 404（而非 403）

## 延伸阅读

- [Notification System Design Patterns](https://www.prisma.io/blog/notification-system-design)
- [Prisma createMany](https://www.prisma.io/docs/orm/prisma-client/queries/crud#createmany)
- [React Query Polling](https://tanstack.com/query/latest/docs/framework/react/guides/polling)
- [Click Outside Hook](https://usehooks.com/useClickOutside)

---

## 新增/修改文件清单

```
packages/backend/
├── src/
│   ├── services/comment.service.ts          ✅ 新增
│   ├── services/notification.service.ts     ✅ 新增
│   ├── controllers/comment.controller.ts    ✅ 新增 (含通知自动生成)
│   ├── controllers/notification.controller.ts ✅ 新增
│   ├── routes/comment.routes.ts             ✅ 新增
│   ├── routes/notification.routes.ts        ✅ 新增
│   ├── middleware/authorize.ts              ✅ 修改 (taskId+commentId 反查)
│   └── app.ts                               ✅ 修改 (挂载 comment/notification 路由)

packages/frontend/
├── src/
│   ├── api/comments.ts                      ✅ 新增
│   ├── api/notifications.ts                 ✅ 新增 (轮询)
│   ├── components/
│   │   ├── comment/CommentSection.tsx       ✅ 新增
│   │   ├── comment/CommentItem.tsx          ✅ 新增 (内联编辑)
│   │   ├── notification/NotificationBell.tsx ✅ 新增
│   │   ├── task/TaskDetailSheet.tsx          ✅ 修改 (接入真实评论)
│   │   └── layout/AppShell.tsx              ✅ 修改 (挂载 NotificationBell)
│   ├── pages/NotificationsPage.tsx          ✅ 新增
│   ├── hooks/useSocket.ts                   ✅ 修改 (comment+notification 事件)
│   └── App.tsx                              ✅ 修改 (通知路由)

docs/
└── phase-5-comments-notifications.md        ✅ 本文档
```

## API 端点

```
POST   /api/tasks/:taskId/comments   → 创建评论 (自动生成通知 + 广播 socket)
GET    /api/tasks/:taskId/comments   → 列表评论 (分页)
PATCH  /api/comments/:commentId      → 编辑评论 (仅作者)
DELETE /api/comments/:commentId      → 删除评论 (仅作者)

GET    /api/notifications            → 列表通知 (分页)
GET    /api/notifications/unread-count → 未读计数
PATCH  /api/notifications/:id/read   → 标记单条已读
PATCH  /api/notifications/read-all   → 全部已读
```

**下一步**：Phase 6 — 文件上传（头像 + 任务附件）
