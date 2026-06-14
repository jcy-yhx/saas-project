import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaces, useDeleteWorkspace } from '@/api/workspaces';
import { useAuthStore } from '@/stores/auth-store';
import WorkspaceForm from '@/components/workspace/WorkspaceForm';
import { Button } from '@/components/ui/button';
import { Plus, Users, FolderKanban, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: workspaces, isLoading } = useWorkspaces();
  const deleteMut = useDeleteWorkspace();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.name ?? 'there'}!</h1>
        <p className="text-muted-foreground mt-1">Your workspaces</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : workspaces && workspaces.length > 0 ? (
        <div className="grid gap-4">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => navigate(`/workspaces/${ws.id}`)}
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <div>
                  <h3 className="font-semibold">{ws.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ws.role} · {ws.slug}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FolderKanban className="w-3.5 h-3.5" /> {ws.projectCount ?? 0}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {ws.memberCount ?? 0}
                </span>
                {ws.role === 'OWNER' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!confirm(`Delete "${ws.name}" and all its data? This cannot be undone.`)) return;
                      deleteMut.mutate(ws.id, {
                        onSuccess: () => toast.success('Workspace deleted'),
                      });
                    }}
                    className="p-1.5 hover:bg-destructive/10 rounded text-destructive"
                    title="Delete workspace"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No workspaces yet. Create one to get started!</p>
        </div>
      )}

      <Button onClick={() => setFormOpen(true)}>
        <Plus className="w-4 h-4 mr-2" />
        New Workspace
      </Button>

      <WorkspaceForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
