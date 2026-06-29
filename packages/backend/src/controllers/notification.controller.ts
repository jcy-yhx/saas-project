import type { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notification.service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await notificationService.listNotifications(req.user!.id, page);
    res.json({ data: result.notifications, meta: result.meta });
  } catch (err) { next(err); }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    await notificationService.markAsRead(req.params.id as string, req.user!.id);
    res.json({ data: { message: 'Marked as read' } });
  } catch (err) { next(err); }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    await notificationService.markAllAsRead(req.user!.id);
    res.json({ data: { message: 'All marked as read' } });
  } catch (err) { next(err); }
}

export async function unreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const count = await notificationService.getUnreadCount(req.user!.id);
    res.json({ data: { count } });
  } catch (err) { next(err); }
}
