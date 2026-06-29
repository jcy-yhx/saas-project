import apiClient from '@/lib/api-client';

export interface SearchResult {
  id: string;
  projectId: string;
  title: string;
  status: string;
  priority: string;
  projectName: string;
  workspaceId: string;
  headline: string | null; // HTML with <mark> highlights
}

export async function searchTasks(
  workspaceId: string,
  q: string,
  options?: { status?: string; priority?: string },
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ workspaceId, q });
  if (options?.status) params.set('status', options.status);
  if (options?.priority) params.set('priority', options.priority);
  params.set('pageSize', '10');

  const { data } = await apiClient.get<{ data: SearchResult[] }>(`/search?${params.toString()}`);
  return data.data;
}
