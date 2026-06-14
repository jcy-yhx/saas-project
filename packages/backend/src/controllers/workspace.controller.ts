import type { Request, Response, NextFunction } from 'express';
import * as workspaceService from '../services/workspace.service.js';

// Helper: Express 5 params need explicit string cast in certain route patterns
function pid(req: Request, name: string): string {
  return req.params[name] as string;
}

// ── CRUD ──

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const workspace = await workspaceService.createWorkspace(req.user!.id, req.body);
    res.status(201).json({ data: workspace });
  } catch (err) { next(err); }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const workspaces = await workspaceService.listWorkspaces(req.user!.id);
    res.json({ data: workspaces });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const workspace = await workspaceService.getWorkspace(pid(req, 'id'), req.user!.id);
    res.json({ data: workspace });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const workspace = await workspaceService.updateWorkspace(pid(req, 'id'), req.body);
    res.json({ data: workspace });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await workspaceService.deleteWorkspace(pid(req, 'id'));
    res.json({ data: { message: 'Workspace deleted' } });
  } catch (err) { next(err); }
}

// ── Members ──

export async function listMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const members = await workspaceService.listMembers(pid(req, 'id'));
    res.json({ data: members });
  } catch (err) { next(err); }
}

export async function updateMemberRole(req: Request, res: Response, next: NextFunction) {
  try {
    const member = await workspaceService.updateMemberRole(
      pid(req, 'id'),
      pid(req, 'userId'),
      req.body.role,
      req.user!.id,
    );
    res.json({ data: member });
  } catch (err) { next(err); }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    await workspaceService.removeMember(pid(req, 'id'), pid(req, 'userId'));
    res.json({ data: { message: 'Member removed' } });
  } catch (err) { next(err); }
}

// ── Invitations ──

export async function createInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const invitation = await workspaceService.createInvitation(
      pid(req, 'id'),
      req.user!.id,
      req.body,
    );
    res.status(201).json({ data: invitation });
  } catch (err) { next(err); }
}

export async function listInvitations(req: Request, res: Response, next: NextFunction) {
  try {
    const invitations = await workspaceService.listInvitations(pid(req, 'id'));
    res.json({ data: invitations });
  } catch (err) { next(err); }
}

export async function acceptInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const workspace = await workspaceService.acceptInvitation(
      pid(req, 'token'),
      req.user!.id,
    );
    res.json({ data: workspace });
  } catch (err) { next(err); }
}
