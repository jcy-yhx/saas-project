import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  count: () => [...notificationKeys.all, 'count'] as const,
};

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Notification[] }>('/notifications');
      return data.data;
    },
    refetchInterval: 30_000, // poll every 30s
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.count(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { count: number } }>('/notifications/unread-count');
      return data.data.count;
    },
    refetchInterval: 15_000, // poll every 15s
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.list() });
      qc.invalidateQueries({ queryKey: notificationKeys.count() });
    },
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.patch('/notifications/read-all');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.list() });
      qc.invalidateQueries({ queryKey: notificationKeys.count() });
    },
  });
}
