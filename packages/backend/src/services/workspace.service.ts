import { createId } from '@paralleldrive/cuid2';
import { getPrisma } from '../config/index.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import type { CreateWorkspaceInput, UpdateWorkspaceInput, CreateInvitationInput } from '@taskflow/shared';

const prisma = getPrisma();

// ── Slug generation ──
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (true) {
    const exists = await prisma.workspace.findUnique({ where: { slug } });
    if (!exists) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

// ── CRUD ──

export async function createWorkspace(userId: string, input: CreateWorkspaceInput) {
  const slug = await ensureUniqueSlug(toSlug(input.name));

  const workspace = await prisma.workspace.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      // Creator becomes OWNER
      members: {
        create: { userId, role: 'OWNER' },
      },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
    },
  });

  return workspace;
}

export async function listWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          _count: { select: { projects: true, members: true } },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  return memberships.map((m) => ({
    ...m.workspace,
    role: m.role,
    projectCount: m.workspace._count.projects,
    memberCount: m.workspace._count.members,
  }));
}

export async function getWorkspace(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!member) throw new ForbiddenError('You are not a member of this workspace');

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      _count: { select: { projects: true, members: true, invitations: true } },
    },
  });
  if (!workspace) throw new NotFoundError('Workspace');

  return { ...workspace, role: member.role };
}

export async function updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new NotFoundError('Workspace');

  // If name changed, regenerate slug
  let data: Record<string, unknown> = {};
  if (input.name) {
    const slug = await ensureUniqueSlug(toSlug(input.name));
    data = { ...input, slug };
  } else {
    data = { ...input };
  }

  return prisma.workspace.update({ where: { id: workspaceId }, data });
}

export async function deleteWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new NotFoundError('Workspace');
  return prisma.workspace.delete({ where: { id: workspaceId } });
}

// ── Members ──

export async function listMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }],
  });
}

export async function updateMemberRole(
  workspaceId: string,
  targetUserId: string,
  newRole: 'ADMIN' | 'MEMBER',
  actorUserId: string,
) {
  const target = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
  });
  if (!target) throw new NotFoundError('Member');

  // Cannot change OWNER's role
  if (target.role === 'OWNER') {
    throw new ForbiddenError('Cannot change the role of the workspace owner');
  }

  // Only OWNER can promote to ADMIN
  if (newRole === 'ADMIN') {
    const actor = await prisma.workspaceMember.findUniqueOrThrow({
      where: { userId_workspaceId: { userId: actorUserId, workspaceId } },
    });
    if (actor.role !== 'OWNER') {
      throw new ForbiddenError('Only the owner can promote members to admin');
    }
  }

  return prisma.workspaceMember.update({
    where: { id: target.id },
    data: { role: newRole },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });
}

export async function removeMember(workspaceId: string, targetUserId: string) {
  const target = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
  });
  if (!target) throw new NotFoundError('Member');

  // Cannot remove OWNER
  if (target.role === 'OWNER') {
    throw new ForbiddenError('Cannot remove the workspace owner');
  }

  return prisma.workspaceMember.delete({ where: { id: target.id } });
}

// ── Invitations ──

export async function createInvitation(
  workspaceId: string,
  inviterId: string,
  input: CreateInvitationInput,
) {
  // Check if user is already a member
  const member = await prisma.user.findUnique({ where: { email: input.email } });
  if (member) {
    const existingMembership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: member.id, workspaceId } },
    });
    if (existingMembership) {
      throw new ConflictError('User is already a member of this workspace');
    }
  }

  const token = createId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await prisma.invitation.create({
    data: {
      workspaceId,
      inviterId,
      email: input.email,
      token,
      role: input.role,
      expiresAt,
    },
  });

  return invitation;
}

export async function listInvitations(workspaceId: string) {
  return prisma.invitation.findMany({
    where: { workspaceId, acceptedAt: null },
    include: {
      inviter: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function acceptInvitation(token: string, userId: string) {
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) throw new NotFoundError('Invitation');

  if (invitation.acceptedAt) {
    throw new ConflictError('This invitation has already been accepted');
  }

  if (invitation.expiresAt < new Date()) {
    throw new ForbiddenError('This invitation has expired');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');

  // Check email match (invitation is for a specific email)
  if (user.email !== invitation.email) {
    throw new ForbiddenError('This invitation is for a different email address');
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });

  await prisma.workspaceMember.create({
    data: {
      userId,
      workspaceId: invitation.workspaceId,
      role: invitation.role,
    },
  });

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: invitation.workspaceId },
  });

  return workspace;
}
