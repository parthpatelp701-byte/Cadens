import { useEffect, useState } from 'react'
import { Heart, MessageCircle, Send, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { Post, Comment } from '@/types'
import { toggleLike, addComment, deletePost, updatePostText, getPostMediaPaths } from '@/lib/posts'
import { addLocalNotification } from '@/lib/notifications'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { useNavigate } from 'react-router-dom'
import { MediaCarousel } from './MediaCarousel'
import { splitMentions } from '@/lib/mentions'

interface Props {
  post: Post & { photo_path?: string; photo_paths?: string[] }
  onUpdate: () => void
  onDeleted?: (id: string) => void
}

function MentionText({ text }: { text: string }) {
  const parts = splitMentions(text)
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'mention' ? (
          <span key={i} className="text-[var(--color-acc)] font-semibold">
            {p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </>
  )
}

export function PostCard({ post, onUpdate, onDeleted }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(post.text || '')

  // Optimistic local state
  const [liked, setLiked] = useState(!!post.liked)
  const [likes, setLikes] = useState(post.likes || 0)
  const [comments, setComments] = useState<Comment[]>(post.comments || [])

  const isOwner = !!(user && post._ownerId && post._ownerId === user.id)
  const mediaPaths = getPostMediaPaths(post)

  useEffect(() => {
    setLiked(!!post.liked)
    setLikes(post.likes || 0)
    setComments(post.comments || [])
    setEditText(post.text || '')
  }, [post.liked, post.likes, post.comments, post.text])

  async function handleLike() {
    if (busy) return
    const prevLiked = liked
    const prevLikes = likes
    // Optimistic
    setLiked(!prevLiked)
    setLikes(prevLiked ? Math.max(0, prevLikes - 1) : prevLikes + 1)
    setBusy(true)
    try {
      await toggleLike({ ...post, liked: prevLiked })
      if (!prevLiked) {
        addLocalNotification({
          type: 'like',
          title: 'New like on a post',
          body: post.text.slice(0, 80),
          targetId: post.id,
          targetType: 'post',
        })
      }
    } catch (err) {
      // Revert
      setLiked(prevLiked)
      setLikes(prevLikes)
      toast('Could not update like', 'error')
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  async function handleComment() {
    if (!commentText.trim() || busy) return
    const body = commentText.trim()
    const optimistic: Comment = {
      id: `temp-${crypto.randomUUID()}`,
      userId: user?.id || '',
      by: user?.email?.split('@')[0] || 'You',
      text: body,
      created_at: new Date().toISOString(),
    }
    setComments((c) => [...c, optimistic])
    setCommentText('')
    setBusy(true)
    try {
      await addComment(post, body)
      // Refresh to get real IDs / server state
      onUpdate()
    } catch (err) {
      setComments((c) => c.filter((x) => x.id !== optimistic.id))
      toast('Could not post comment', 'error')
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!isOwner || busy) return
    if (!confirm('Delete this post? This cannot be undone.')) return
    setBusy(true)
    setMenuOpen(false)
    try {
      await deletePost(post)
      toast('Post deleted', 'success')
      onDeleted?.(post.id)
      onUpdate()
    } catch (err: any) {
      toast(err.message || 'Could not delete post', 'error')
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveEdit() {
    if (!isOwner || busy) return
    const next = editText.trim()
    if (!next) {
      toast('Post cannot be empty', 'error')
      return
    }
    setBusy(true)
    try {
      await updatePostText(post, next)
      setEditing(false)
      toast('Post updated', 'success')
      onUpdate()
    } catch (err: any) {
      toast(err.message || 'Could not update post', 'error')
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[16px] p-4 shadow-sm relative">
      <header className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[var(--color-s3)] flex items-center justify-center font-bold text-sm">
          {(post.avatar || post.author?.[0] || '?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => post._ownerId && navigate(`/profile/${post._ownerId}`)}
            className="font-bold text-sm truncate text-left hover:underline disabled:no-underline"
            disabled={!post._ownerId}
          >
            {post.author}
          </button>
          <p className="text-xs text-[var(--color-dim)]">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            {' · '}
            {post.privacy === 'me' || post.privacy === 'private'
              ? 'Only you'
              : post.privacy === 'circle'
                ? 'Family'
                : 'Group'}
          </p>
        </div>
        {isOwner && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 rounded-full text-[var(--color-dim)] hover:bg-[var(--color-s2)] hover:text-[var(--color-txt)]"
              aria-label="Post options"
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 w-40 bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[12px] shadow-lg py-1 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true)
                      setMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--color-s2)]"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-s2)]"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {editing ? (
        <div className="mb-3 space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="w-full bg-[var(--color-s2)] border border-[var(--color-line)] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[var(--color-acc)] resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setEditText(post.text || '')
              }}
              className="px-3 py-1.5 text-sm rounded-full border border-[var(--color-line)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={busy || !editText.trim()}
              className="px-3 py-1.5 text-sm rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        (post.text || post.mood) && (
          <div className="text-[0.95rem] leading-relaxed mb-3 whitespace-pre-wrap">
            {post.mood && <span className="mr-1.5">{post.mood}</span>}
            <MentionText text={post.text || ''} />
          </div>
        )
      )}

      {mediaPaths.length > 0 && <MediaCarousel paths={mediaPaths} />}

      <footer className="flex items-center gap-5 pt-1">
        <button
          type="button"
          onClick={handleLike}
          disabled={busy}
          className={`flex items-center gap-1.5 text-sm font-semibold transition ${
            liked ? 'text-[var(--color-acc2)]' : 'text-[var(--color-dim)] hover:text-[var(--color-txt)]'
          }`}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          {likes}
        </button>

        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-dim)] hover:text-[var(--color-txt)]"
        >
          <MessageCircle size={18} />
          {comments.length}
        </button>
      </footer>

      {showComments && (
        <div className="mt-4 pt-3 border-t border-[var(--color-line2)] space-y-3">
          {comments.length === 0 && (
            <p className="text-sm text-[var(--color-dim)] text-center py-2">No comments yet — be the first</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[var(--color-s3)] flex items-center justify-center text-xs font-bold shrink-0">
                {(c.by?.[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-bold">{c.by}</span>{' '}
                  <span className="text-[var(--color-txt)]">
                    <MentionText text={c.text} />
                  </span>
                </p>
                <p className="text-[11px] text-[var(--color-mute)] mt-0.5">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}

          <div className="flex gap-2 items-center">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleComment()}
              placeholder="Write a comment… @name to mention"
              className="flex-1 bg-[var(--color-s2)] border border-[var(--color-line)] rounded-full px-3.5 py-2 text-sm outline-none focus:border-[var(--color-acc)]"
            />
            <button
              type="button"
              onClick={handleComment}
              disabled={!commentText.trim() || busy}
              className="w-9 h-9 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] flex items-center justify-center disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
