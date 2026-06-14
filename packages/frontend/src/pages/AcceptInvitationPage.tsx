import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export default function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      // Store the invite token and redirect to login
      sessionStorage.setItem('pendingInviteToken', token!);
      navigate(`/login?invite=${token}`, { replace: true });
      return;
    }

    if (!token) return;

    apiClient.post(`/workspaces/invitations/${token}/accept`)
      .then((res) => {
        setStatus('success');
        const ws = res.data.data;
        setTimeout(() => navigate(`/workspaces/${ws.id}`), 1500);
      })
      .catch((err: unknown) => {
        setStatus('error');
        setErrorMsg(
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
          ?? 'Failed to accept invitation',
        );
      });
  }, [token, isAuthenticated, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        {status === 'loading' && (
          <p className="text-muted-foreground">Accepting invitation...</p>
        )}
        {status === 'success' && (
          <div>
            <h1 className="text-xl font-bold text-green-600">Joined!</h1>
            <p className="text-muted-foreground mt-2">Redirecting to workspace...</p>
          </div>
        )}
        {status === 'error' && (
          <div>
            <h1 className="text-xl font-bold text-destructive">Oops</h1>
            <p className="text-muted-foreground mt-2">{errorMsg}</p>
            <Button className="mt-4" onClick={() => navigate('/')}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
