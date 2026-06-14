import { Routes, Route } from 'react-router-dom';
import { useSessionCheck } from '@/api/auth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';
import AuthLayout from '@/components/layout/AuthLayout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import OAuthCallbackPage from '@/pages/OAuthCallbackPage';
import AcceptInvitationPage from '@/pages/AcceptInvitationPage';
import DashboardPage from '@/pages/DashboardPage';
import WorkspacePage from '@/pages/WorkspacePage';
import MembersPage from '@/pages/MembersPage';
import WorkspaceSettingsPage from '@/pages/WorkspaceSettingsPage';
import ProfilePage from '@/pages/ProfilePage';
import ProjectPlaceholder from '@/pages/ProjectPlaceholder';

export default function App() {
  // Attempt session restore from httpOnly refresh cookie
  useSessionCheck();

  return (
    <Routes>
      {/* Public auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* OAuth callback */}
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

      {/* Accept invitation (may require redirect to login) */}
      <Route path="/invitations/:token" element={<AcceptInvitationPage />} />

      {/* Protected app routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Workspace sub-routes */}
          <Route path="/workspaces/:workspaceId" element={<WorkspacePage />}>
            <Route index element={<ProjectPlaceholder />} />
            <Route path="list" element={<ProjectPlaceholder />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="settings" element={<WorkspaceSettingsPage />} />
          </Route>
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Page not found</p>
        </div>
      } />
    </Routes>
  );
}
