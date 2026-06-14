import type {
  TaskStatus,
  Priority,
  WorkspaceRole,
  InvitationRole,
  NotificationType,
} from '../constants/index.js';

// ── User ──
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Workspace ──
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user?: User;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  inviterId: string;
  email: string;
  token: string;
  role: InvitationRole;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

// ── Project ──
export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number };
}

// ── Task ──
export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  position: number;
  dueDate: string | null;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  creator?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  assignees?: TaskAssignee[];
  _count?: { comments: number; attachments: number };
}

export interface TaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  assignedAt: string;
  user?: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
}

// ── Comment ──
export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'name' | 'avatarUrl'>;
}

// ── Attachment ──
export interface Attachment {
  id: string;
  taskId: string;
  userId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  createdAt: string;
}

// ── Notification ──
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ── Auth ──
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

// ── API Envelope ──
export interface ApiResponse<T = unknown> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
}
