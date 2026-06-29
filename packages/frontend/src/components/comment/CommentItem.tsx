import { useState } from 'react';
import type { Comment } from '@/api/comments';
import { useAuthStore } from '@/stores/auth-store';
import { useUpdateComment, useDeleteComment } from '@/api/comments';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Pencil, Trash2, Check, X } from 'lucide-react';

interface Props {
  comment: Comment;
  taskId: string;
}

export default function CommentItem({ comment, taskId }: Props) {
  const { user } = useAuthStore();
  const updateMut = useUpdateComment(taskId);
  const deleteMut = useDeleteComment(taskId);
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);

  const isAuthor = user?.id === comment.userId;
  const wasEdited = comment.updatedAt !== comment.createdAt;

  const handleSave = () => {
    if (editedContent.trim() && editedContent !== comment.content) {
      updateMut.mutate({ id: comment.id, content: editedContent.trim() });
    }
    setEditing(false);
  };

  return (
    <div className="group py-3">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
          {comment.user.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{comment.user.name}</span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
            </span>
            {wasEdited && (
              <span className="text-xs text-muted-foreground italic">(edited)</span>
            )}
          </div>

          {editing ? (
            <div className="mt-1 space-y-2">
              <textarea
                className="w-full text-sm bg-muted/30 rounded-md border px-2 py-1 resize-y min-h-[60px]"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                autoFocus
              />
              <div className="flex gap-1">
                <button onClick={handleSave} className="p-1 hover:bg-accent rounded text-green-600">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setEditing(false); setEditedContent(comment.content); }} className="p-1 hover:bg-accent rounded text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm mt-0.5 whitespace-pre-wrap">{comment.content}</p>
          )}
        </div>

        {isAuthor && !editing && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditing(true)} className="p-1 hover:bg-accent rounded text-muted-foreground">
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={() => { if (confirm('Delete comment?')) deleteMut.mutate(comment.id); }}
              className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
