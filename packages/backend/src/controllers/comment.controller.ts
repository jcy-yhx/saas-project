import type { Request, Response, NextFunction } from 'express';
import { getIO } from '../config/index.js';
import * as commentService from '../services/comment.service.js';
import * as notificationService from '../services/notification.service.js';
import { getPrisma } from '../config/index.js';

const prisma = getPrisma();

function cid(req: Request): string { return req.params.commentId as string; }
function tid(req: Request): string { return req.params.taskId as string; }

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await commentService.listComments(tid(req), page);
    res.json({ data: result.comments, meta: result.meta });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const taskId = tid(req);
    const comment = await commentService.createComment(taskId, req.user!.id, req.body);

    res.status(201).json({ data: comment });

    // Notify task assignees + creator about new comment
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignees: { select: { userId: true } }, creator: { select: { id: true, name: true } } },
    });
    if (task) {
      const notifyIds = new Set(task.assignees.map((a) => a.userId));
      if (task.creatorId !== req.user!.id) notifyIds.add(task.creatorId);
      notifyIds.delete(req.user!.id);

      await notificationService.notifyUsers(
        Array.from(notifyIds),
        'COMMENT_ADDED',
        'New comment',
        `${req.user?.email} commented on "${task.title}"`,
        { taskId, commentId: comment.id },
      );

      // Real-time: broadcast to project room
      try {
        const io = getIO();
        io.to(`project:${task.projectId}`).emit('comment:created', { comment, taskId });
      } catch { /* noop */ }
    }
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const comment = await commentService.updateComment(cid(req), req.user!.id, req.body);
    res.json({ data: comment });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await commentService.deleteComment(cid(req), req.user!.id);
    res.json({ data: result });
  } catch (err) { next(err); }
}
