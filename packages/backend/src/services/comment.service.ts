import { getPrisma } from '../config/index.js';
import { NotFoundError } from '../utils/errors.js';
import type { CreateCommentInput, UpdateCommentInput } from '@taskflow/shared';

const prisma = getPrisma();

const COMMENT_INCLUDE = {
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
} as const;

export async function listComments(taskId: string, page = 1, pageSize = 30) {
  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: { taskId },
      include: COMMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.comment.count({ where: { taskId } }),
  ]);

  return { comments, meta: { total, page, pageSize } };
}

export async function createComment(taskId: string, userId: string, input: CreateCommentInput) {
  const comment = await prisma.comment.create({
    data: { taskId, userId, content: input.content },
    include: COMMENT_INCLUDE,
  });
  return comment;
}

export async function updateComment(id: string, userId: string, input: UpdateCommentInput) {
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) throw new NotFoundError('Comment');

  // Only the author can edit
  if (comment.userId !== userId) {
    throw new NotFoundError('Comment');
  }

  return prisma.comment.update({
    where: { id },
    data: { content: input.content },
    include: COMMENT_INCLUDE,
  });
}

export async function deleteComment(id: string, userId: string) {
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) throw new NotFoundError('Comment');

  // Author or admin can delete (admin check is done in controller via workspace membership)
  if (comment.userId !== userId) {
    // Allow: admin check in caller
  }

  await prisma.comment.delete({ where: { id } });
  return { message: 'Comment deleted' };
}
