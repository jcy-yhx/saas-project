declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string;
    };
    workspaceMember?: {
      workspaceId: string;
      role: string;
    };
  }
}
