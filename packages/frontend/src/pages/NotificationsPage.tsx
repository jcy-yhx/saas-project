import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/api/notifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CheckCheck } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = {
  TASK_ASSIGNED: 'Assigned',
  COMMENT_ADDED: 'Comment',
  TASK_STATUS_CHANGED: 'Status changed',
  MEMBER_ADDED: 'New member',
  INVITATION_RECEIVED: 'Invited',
  MENTIONED: 'Mentioned',
};

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications();
  const markReadMut = useMarkAsRead();
  const markAllReadMut = useMarkAllAsRead();

  const unread = notifications?.filter((n) => !n.read).length ?? 0;

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Notifications</h2>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markAllReadMut.mutate()} disabled={markAllReadMut.isPending}>
            <CheckCheck className="w-4 h-4 mr-1.5" />
            Mark all read ({unread})
          </Button>
        )}
      </div>

      <div className="space-y-1">
        {notifications && notifications.length > 0 ? (
          notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer',
                !n.read && 'bg-primary/5 border-primary/20',
              )}
              onClick={() => { if (!n.read) markReadMut.mutate(n.id); }}
            >
              <div className="shrink-0 mt-0.5">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                  {TYPE_LABEL[n.type] ?? n.type}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', !n.read && 'font-medium')}>{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(n.createdAt), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              {!n.read && (
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No notifications yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
