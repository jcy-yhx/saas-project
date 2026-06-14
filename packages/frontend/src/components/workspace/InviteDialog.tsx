import { useState } from 'react';
import { useCreateInvitation, useInvitations } from '@/api/workspaces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

export default function InviteDialog({ workspaceId, open, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const invMutation = useCreateInvitation(workspaceId);
  const { data: invitations } = useInvitations(workspaceId);

  if (!open) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      await invMutation.mutateAsync({ email: email.trim(), role });
      setEmail('');
      toast.success('Invitation sent');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to send invitation';
      toast.error(msg);
    }
  };

  const inviteLink = (token: string) => `${window.location.origin}/invitations/${token}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Invite Members</h2>

        <form onSubmit={handleInvite} className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <Button type="submit" disabled={invMutation.isPending || !email.trim()} className="w-full">
            <Mail className="w-4 h-4 mr-2" />
            {invMutation.isPending ? 'Sending...' : 'Send Invitation'}
          </Button>
        </form>

        {invitations && invitations.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">Pending Invitations</h3>
            <ul className="space-y-2">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/50">
                  <div>
                    <p className="font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.role} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink(inv.token));
                      toast.success('Link copied!');
                    }}
                    className="p-1 hover:bg-accent rounded"
                    title="Copy invite link"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
