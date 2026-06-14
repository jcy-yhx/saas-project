import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMembers, useUpdateMemberRole, useRemoveMember } from '@/api/workspaces';
import InviteDialog from '@/components/workspace/InviteDialog';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Plus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_BADGE: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  MEMBER: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

export default function MembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user } = useAuthStore();
  const { data: members, isLoading } = useMembers(workspaceId!);
  const updateRoleMut = useUpdateMemberRole(workspaceId!);
  const removeMemberMut = useRemoveMember(workspaceId!);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

  const currentMember = members?.find((m) => m.userId === user?.id);
  const isAdmin = currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN';

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Members ({members?.length ?? 0})</h2>
        {isAdmin && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Invite
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {members?.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                {member.user.name[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{member.user.name}</p>
                <p className="text-xs text-muted-foreground">{member.user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {member.role === 'OWNER' ? (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE.OWNER}`}>
                  Owner
                </span>
              ) : isAdmin && member.userId !== user?.id ? (
                <div className="flex items-center gap-1">
                  <select
                    value={member.role}
                    onChange={(e) => {
                      updateRoleMut.mutate(
                        { userId: member.userId, role: e.target.value as 'ADMIN' | 'MEMBER' },
                        { onSuccess: () => toast.success('Role updated') },
                      );
                    }}
                    className="text-xs h-7 rounded-md border border-input bg-transparent px-2"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                  </select>
                  <button
                    onClick={() => {
                      if (!confirm(`Remove ${member.user.name} from workspace?`)) return;
                      removeMemberMut.mutate(member.userId);
                    }}
                    className="p-1 hover:bg-destructive/10 rounded text-destructive"
                    title="Remove member"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[member.role] ?? ROLE_BADGE.MEMBER}`}>
                  {member.role}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <InviteDialog workspaceId={workspaceId!} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
