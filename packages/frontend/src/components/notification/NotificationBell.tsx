import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead } from '@/api/notifications';
import { Bell, Check } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function NotificationBell() {
  const { data: unreadCount } = useUnreadCount();
  const { data: notifications } = useNotifications();
  const markReadMut = useMarkAsRead();
  const markAllReadMut = useMarkAllAsRead();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const recentNotifications = notifications?.slice(0, 5) ?? [];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 hover:bg-accent rounded-md"
      >
        <Bell className="w-4 h-4" />
        {(unreadCount ?? 0) > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount! > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-card shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {(unreadCount ?? 0) > 0 && (
              <button
                onClick={() => markAllReadMut.mutate()}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-auto">
            {recentNotifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No notifications
              </p>
            ) : (
              recentNotifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'flex items-start gap-2 px-4 py-2.5 hover:bg-muted/50 cursor-pointer text-sm',
                    !n.read && 'bg-primary/5',
                  )}
                  onClick={() => { if (!n.read) markReadMut.mutate(n.id); }}
                >
                  <div className="shrink-0 mt-0.5">
                    {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('truncate', !n.read && 'font-medium')}>{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(n.createdAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markReadMut.mutate(n.id); }}
                      className="p-0.5 hover:bg-accent rounded shrink-0"
                      title="Mark as read"
                    >
                      <Check className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          {notifications && notifications.length > 5 && (
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-primary hover:underline py-2 border-t"
            >
              View all notifications
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
