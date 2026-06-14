import { useParams } from 'react-router-dom';
import { useWorkspace } from '@/api/workspaces';
import { useForm } from 'react-hook-form';
import { updateWorkspaceSchema, type UpdateWorkspaceInput } from '@taskflow/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function WorkspaceSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data: workspace, isLoading } = useWorkspace(workspaceId!);

  const { register, handleSubmit, formState: { isSubmitting }, reset } = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(updateWorkspaceSchema),
    values: workspace ? { name: workspace.name, description: workspace.description ?? '' } : undefined,
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  if (!workspace) return <div className="p-6 text-sm text-destructive">Workspace not found.</div>;

  const isOwner = workspace.role === 'OWNER';

  const onSubmit = async (data: UpdateWorkspaceInput) => {
    try {
      await apiClient.patch(`/workspaces/${workspaceId}`, data);
      toast.success('Workspace updated');
    } catch {
      toast.error('Failed to update workspace');
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <h2 className="text-lg font-semibold">Workspace Settings</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <Input {...register('name')} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <Input {...register('description')} placeholder="Optional description" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">Slug</label>
          <p className="text-sm">{workspace.slug}</p>
        </div>
        <Button type="submit" disabled={isSubmitting || !isOwner}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
        {!isOwner && (
          <p className="text-xs text-muted-foreground">Only the owner can edit workspace settings.</p>
        )}
      </form>
    </div>
  );
}
