import type { Request, Response, NextFunction } from 'express';
import { getPrisma } from '../config/index.js';
import { ForbiddenError, UnauthenticatedError } from '../utils/errors.js';

// ── RBAC Role enum ──
const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

/**
 * Require that the authenticated user is a member of the workspace
 * identified by :id param in the route.
 *
 * Attaches `req.workspaceMember` = { workspaceId, role } on success.
 */
export function requireWorkspaceMembership(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const userId = req.user?.id;
  if (!userId) throw new UnauthenticatedError('Authentication required');

  // Routes use :id for workspaceId
  const workspaceId = req.params.id as string | undefined;

  if (!workspaceId) {
    next();
    return;
  }

  getPrisma()
    .workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    })
    .then((member) => {
      if (!member) {
        throw new ForbiddenError('You are not a member of this workspace');
      }
      req.workspaceMember = { workspaceId, role: member.role };
      next();
    })
    .catch(next);
}

/**
 * Factory: create middleware that requires a minimum role.
 * Must be used after `requireWorkspaceMembership`.
 *
 * @example
 * router.patch('/:id', authenticate, requireWorkspaceMembership, requireRole('ADMIN'), controller.update);
 */
export function requireRole(minRole: string) {
  const minLevel = ROLE_HIERARCHY[minRole] ?? 0;

  return (req: Request, _res: Response, next: NextFunction): void => {
    const member = req.workspaceMember;
    if (!member) {
      throw new ForbiddenError('Workspace membership required');
    }

    const userLevel = ROLE_HIERARCHY[member.role] ?? 0;
    if (userLevel < minLevel) {
      throw new ForbiddenError(`This action requires at least ${minRole} role`);
    }

    next();
  };
}
