import { useState } from 'react';
import { useComments, useCreateComment } from '@/api/comments';
import { useAuthStore } from '@/stores/auth-store';
import CommentItem from './CommentItem';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';

interface Props {
  taskId: string;
}

export default function CommentSection({ taskId }: Props) {
  const { data: comments, isLoading } = useComments(taskId);
  const createMut = useCreateComment(taskId);
  const [content, setContent] = useState('');
  const { isAuthenticated } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await createMut.mutateAsync({ content: content.trim() });
    setContent('');
  };

  return (
    <div>
      <h4 className="text-sm font-medium text-foreground mb-3">
        Comments {comments ? `(${comments.length})` : ''}
      </h4>

      {/* Comment form */}
      {isAuthenticated && (
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="flex gap-2">
            <textarea
              className="flex-1 min-h-[60px] text-sm bg-muted/30 rounded-md border px-3 py-2 resize-y"
              placeholder="Write a comment..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={2}
            />
            <Button
              type="submit"
              size="sm"
              disabled={createMut.isPending || !content.trim()}
              className="shrink-0 mt-auto"
            >
              {createMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Comment list */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : comments && comments.length > 0 ? (
        <div className="divide-y">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} taskId={taskId} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No comments yet. Be the first to comment!
        </p>
      )}
    </div>
  );
}
