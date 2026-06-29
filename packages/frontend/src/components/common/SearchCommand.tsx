import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { searchTasks, type SearchResult } from '@/api/search';
import { cn } from '@/lib/utils';
import { Search, Loader2, CornerDownLeft } from 'lucide-react';

const STATUS_BADGES: Record<string, string> = {
  BACKLOG: 'bg-gray-200', TODO: 'bg-blue-200',
  IN_PROGRESS: 'bg-yellow-200', IN_REVIEW: 'bg-purple-200', DONE: 'bg-green-200',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchCommand({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId?: string }>();

  // Listen for Cmd+K / Ctrl+K to toggle
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) onClose();
        else { /* parent handles open via button */ }
      }
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onClose]);

  // Focus input on open, reset on close
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search — only within current workspace
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }

    const timer = setTimeout(async () => {
      if (!workspaceId) return;
      setLoading(true);
      try {
        const res = await searchTasks(workspaceId, query.trim());
        setResults(res);
        setSelectedIndex(0);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, workspaceId]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (results[selectedIndex]) {
        const item = results[selectedIndex];
        navigate(`/workspaces/${item.workspaceId}/projects/${item.projectId}`);
        onClose();
      }
    }
  }, [results, selectedIndex, navigate, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />

      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg">
        <div className="rounded-xl border bg-card shadow-2xl overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search tasks in this workspace..."
              className="flex-1 bg-transparent border-none outline-none text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground bg-muted">
              esc
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-auto">
            {!workspaceId ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Select a workspace to search
              </p>
            ) : query.trim() && results.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No results found for &ldquo;{query}&rdquo;
              </p>
            ) : !query.trim() ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Type to search across all tasks
              </p>
            ) : null}

            {results.map((item, idx) => (
              <button
                key={item.id}
                className={cn(
                  'w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors border-b last:border-b-0',
                  idx === selectedIndex && 'bg-accent',
                )}
                onClick={() => {
                  navigate(`/workspaces/${item.workspaceId}/projects/${item.projectId}`);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium truncate">{item.title}</span>
                  <span className={cn('text-[10px] px-1 py-0 rounded shrink-0', STATUS_BADGES[item.status] ?? 'bg-muted')}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </div>
                {item.headline && (
                  <p
                    className="text-xs text-muted-foreground line-clamp-2 [&_mark]:bg-yellow-200 [&_mark]:text-yellow-900 [&_mark]:px-0.5 [&_mark]:rounded-sm"
                    dangerouslySetInnerHTML={{ __html: item.headline }}
                  />
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.projectName}</p>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t bg-muted/30 text-[10px] text-muted-foreground">
            <span>↑↓ Navigate</span>
            <span>↵ Open</span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </>
  );
}
