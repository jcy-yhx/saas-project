import { getPrisma } from '../config/index.js';

const prisma = getPrisma();

type NotificationType =
  | 'TASK_ASSIGNED'
  | 'COMMENT_ADDED'
  | 'TASK_STATUS_CHANGED'
  | 'MEMBER_ADDED'
  | 'INVITATION_RECEIVED'
  | 'MENTIONED';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
    },
  });
}

/**
 * Create notifications for multiple users (e.g., all task assignees except the actor).
 */
export async function notifyUsers(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  metadata?: Record<string, unknown>,
) {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      title,
      body,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    })),
  });
}

export async function listNotifications(userId: string, page = 1, pageSize = 30) {
  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return { notifications, meta: { total, page, pageSize, unreadCount } };
}

export async function markAsRead(id: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}
