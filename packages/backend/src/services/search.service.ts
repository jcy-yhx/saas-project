import { getPrisma } from '../config/index.js';
import type { SearchQueryInput } from '@taskflow/shared';

const prisma = getPrisma();

interface SearchResultRow {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  position: number;
  dueDate: string | null;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  projectName: string;
  workspaceId: string;
  headline: string | null; // HTML-highlighted snippet
  rank: number;
}

interface SearchResult {
  tasks: Array<{
    id: string;
    projectId: string;
    title: string;
    status: string;
    priority: string;
    projectName: string;
    workspaceId: string;
    headline: string | null;
  }>;
  meta: { total: number; page: number; pageSize: number };
}

/**
 * Full-text search across tasks in a workspace using PostgreSQL tsvector.
 * Uses ts_rank for relevance scoring and ts_headline for highlighted snippets.
 */
export async function search(query: SearchQueryInput): Promise<SearchResult> {
  const { workspaceId, q, status, priority, page, pageSize } = query;

  // Build filter clauses
  const conditions: string[] = [`p."workspaceId" = $1`];
  const params: (string | number)[] = [workspaceId];
  let i = 2;

  conditions.push(`t."searchVector" @@ to_tsquery('english', $${i})`);
  params.push(formatQuery(q));
  i++;

  if (status) {
    conditions.push(`t."status" = $${i}`);
    params.push(status);
    i++;
  }
  if (priority) {
    conditions.push(`t."priority" = $${i}`);
    params.push(priority);
    i++;
  }

  const whereClause = conditions.join(' AND ');

  // Count total matches
  const countResult = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
    `SELECT count(*) as total FROM "Task" t JOIN "Project" p ON t."projectId" = p.id WHERE ${whereClause}`,
    ...params,
  );
  const total = Number(countResult[0]?.total ?? 0);

  // Search with ranking and highlights
  const offset = (page - 1) * pageSize;
  const searchSql = `
    SELECT
      t."id",
      t."projectId",
      t."title",
      t."description",
      t."status",
      t."priority",
      t."position",
      t."dueDate",
      t."creatorId",
      t."createdAt",
      t."updatedAt",
      p."name" as "projectName",
      p."workspaceId",
      ts_headline('english', coalesce(t."title", ''), to_tsquery('english', $${params.length + 1}), 'MaxWords=40, MinWords=15, ShortWord=2, StartSel=<mark>, StopSel=</mark>') || ' … ' ||
      ts_headline('english', coalesce(t."description", ''), to_tsquery('english', $${params.length + 1}), 'MaxWords=30, MinWords=8, StartSel=<mark>, StopSel=</mark>') as headline,
      ts_rank(t."searchVector", to_tsquery('english', $${params.length + 1})) as rank
    FROM "Task" t
    JOIN "Project" p ON t."projectId" = p.id
    WHERE ${whereClause}
    ORDER BY rank DESC
    LIMIT $${params.length + 2} OFFSET $${params.length + 3}
  `;

  const paramsWithSearch = [
    ...params,
    formatQuery(q), // for ts_headline and ts_rank (param count+1)
    pageSize,        // LIMIT
    offset,          // OFFSET
  ];

  const rows = await prisma.$queryRawUnsafe<SearchResultRow[]>(searchSql, ...paramsWithSearch);

  return {
    tasks: rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      status: r.status,
      priority: r.priority,
      projectName: r.projectName,
      workspaceId: r.workspaceId,
      headline: r.headline,
    })),
    meta: { total, page, pageSize },
  };
}

/**
 * Convert a user's search term into a tsquery-safe format.
 * Splits on whitespace, prefixes each word with a stemming operator (:*),
 * and joins with & (AND). Escapes special characters.
 */
function formatQuery(q: string): string {
  return q
    .replace(/[^\w\s]/g, ' ')  // Remove special chars
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word}:*`) // Prefix matching
    .join(' & ');
}
