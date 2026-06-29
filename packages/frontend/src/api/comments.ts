import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

export interface CommentUser {
  id: string; name: string; email: string; avatarUrl: string | null;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: CommentUser;
}

export const commentKeys = {
  all: ['comments'] as const,
  byTask: (taskId: string) => [...commentKeys.all, 'task', taskId] as const,
};

export function useComments(taskId: string | undefined) {
  return useQuery({
    queryKey: commentKeys.byTask(taskId!),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Comment[]; meta: { total: number } }>(`/tasks/${taskId}/comments`);
      return data.data;
    },
    enabled: !!taskId,
  });
}

export function useCreateComment(taskId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { content: string }) => {
      const { data } = await apiClient.post<{ data: Comment }>(`/tasks/${taskId}/comments`, input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentKeys.byTask(taskId) });
    },
  });
}

export function useUpdateComment(taskId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { data } = await apiClient.patch<{ data: Comment }>(`/comments/${id}`, { content });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentKeys.byTask(taskId) });
    },
  });
}

export function useDeleteComment(taskId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/comments/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentKeys.byTask(taskId) });
      toast.success('Comment deleted');
    },
  });
}
