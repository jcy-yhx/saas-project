import { useParams, Link, Outlet, useLocation } from 'react-router-dom';
import { useWorkspace } from '@/api/workspaces';
import { cn } from '@/lib/utils';
import { LayoutGrid, List, Settings, Users } from 'lucide-react';

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const location = useLocation();
  const { data: workspace, isLoading } = useWorkspace(workspaceId!);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!workspace) {
    return <div className="p-6 text-sm text-destructive">Workspace not found.</div>;
  }

  const tabs = [
    { label: 'Board', href: `/workspaces/${workspaceId}`, icon: LayoutGrid },
    { label: 'List', href: `/workspaces/${workspaceId}/list`, icon: List },
    { label: 'Members', href: `/workspaces/${workspaceId}/members`, icon: Users },
    { label: 'Settings', href: `/workspaces/${workspaceId}/settings`, icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === `/workspaces/${workspaceId}`) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Workspace header */}
      <div className="border-b bg-card px-6 py-3">
        <h1 className="text-lg font-semibold">{workspace.name}</h1>
        {workspace.description && (
          <p className="text-sm text-muted-foreground mt-0.5">{workspace.description}</p>
        )}
        <nav className="flex gap-1 mt-3">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                isActive(tab.href)
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Sub-page content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
