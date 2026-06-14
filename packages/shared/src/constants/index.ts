export const TASK_STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const WORKSPACE_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const INVITATION_ROLES = ['ADMIN', 'MEMBER'] as const;
export type InvitationRole = (typeof INVITATION_ROLES)[number];

export const NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'COMMENT_ADDED',
  'TASK_STATUS_CHANGED',
  'MEMBER_ADDED',
  'INVITATION_RECEIVED',
  'MENTIONED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
