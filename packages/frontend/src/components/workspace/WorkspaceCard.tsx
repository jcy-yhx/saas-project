import type { Workspace } from '@/api/workspaces';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Props {
  workspace: Workspace;
  isActive?: boolean;
}

export default function WorkspaceCard({ workspace, isActive }: Props) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/workspaces/${workspace.id}`)}
      className={cn(
        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
      )}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
        <span className="truncate font-medium">{workspace.name}</span>
      </div>
    </button>
  );
}
