import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  listBoards,
  createBoard,
  listIdeas,
  createIdea,
  reactIdea,
  decideBoard,
  type IdeaBoard,
  type Idea,
} from '@/lib/ideas'
import { ArrowLeft, Plus, ThumbsUp, Check, Lightbulb } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { formatDistanceToNow } from 'date-fns'

export function IdeaBoardPage() {
  const { groupId, boardId } = useParams<{ groupId: string; boardId?: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [boards, setBoards] = useState<IdeaBoard[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [board, setBoard] = useState<IdeaBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<'new' | 'top'>('new')
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [ideaText, setIdeaText] = useState('')
  const [ideaLink, setIdeaLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadBoards = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    setError('')
    try {
      const data = await listBoards(groupId)
      setBoards(data)
    } catch (err: any) {
      setError(err.message || 'Run SQL 07-idea-boards.sql')
    } finally {
      setLoading(false)
    }
  }, [groupId])

  const loadIdeas = useCallback(async () => {
    if (!boardId) return
    setLoading(true)
    try {
      const data = await listIdeas(boardId, sort)
      setIdeas(data)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to load ideas')
    } finally {
      setLoading(false)
    }
  }, [boardId, sort])

  useEffect(() => {
    if (boardId) {
      loadIdeas()
      listBoards(groupId!).then((bs) => {
        setBoards(bs)
        setBoard(bs.find((b) => b.id === boardId) || null)
      }).catch(() => {})
    } else {
      loadBoards()
    }
  }, [boardId, groupId, loadBoards, loadIdeas])

  async function handleCreateBoard() {
    if (!groupId || !newBoardTitle.trim() || busy) return
    setBusy(true)
    try {
      const b = await createBoard(groupId, newBoardTitle.trim())
      setNewBoardTitle('')
      toast('Board created', 'success')
      navigate(`/people/${groupId}/ideas/${b.id}`)
    } catch (err: any) {
      toast(err.message || 'Could not create board', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddIdea() {
    if (!boardId || !ideaText.trim() || busy) return
    setBusy(true)
    try {
      await createIdea(boardId, ideaText.trim(), ideaLink.trim() || undefined)
      setIdeaText('')
      setIdeaLink('')
      toast('Idea added', 'success')
      await loadIdeas()
    } catch (err: any) {
      toast(err.message || 'Could not add idea', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleReact(id: string) {
    try {
      await reactIdea(id)
      await loadIdeas()
    } catch (err: any) {
      toast(err.message || 'Failed', 'error')
    }
  }

  async function handleDecide(ideaId: string) {
    if (!boardId || !confirm('Mark this as the decision?')) return
    try {
      await decideBoard(boardId, ideaId)
      toast('Marked decided', 'success')
      setBoard((b) => (b ? { ...b, status: 'decided', decided_idea_id: ideaId } : b))
      await loadIdeas()
    } catch (err: any) {
      toast(err.message || 'Failed', 'error')
    }
  }

  // Board list for group
  if (!boardId) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate(`/people/${groupId}`)}
          className="flex items-center gap-2 text-sm text-[var(--color-dim)]"
        >
          <ArrowLeft size={16} /> Group
        </button>
        <header>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb size={22} /> Idea boards
          </h1>
          <p className="text-sm text-[var(--color-dim)]">Plan trips, birthdays, and decisions together.</p>
        </header>

        <div className="flex gap-2">
          <input
            value={newBoardTitle}
            onChange={(e) => setNewBoardTitle(e.target.value)}
            placeholder="e.g. Japan hotels, Mom’s birthday…"
            className="flex-1 bg-[var(--color-s2)] border border-[var(--color-line)] rounded-full px-4 py-2.5 text-sm outline-none focus:border-[var(--color-acc)]"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
          />
          <button
            type="button"
            onClick={handleCreateBoard}
            disabled={busy || !newBoardTitle.trim()}
            className="min-h-10 px-4 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] text-sm font-bold disabled:opacity-40"
          >
            <Plus size={18} />
          </button>
        </div>

        {error && (
          <div className="text-sm text-[var(--color-danger)]">{error}</div>
        )}

        {loading ? (
          <ListSkeleton rows={3} />
        ) : boards.length === 0 ? (
          <div className="py-12 text-center text-[var(--color-dim)]">
            <p className="font-medium">No boards yet</p>
            <p className="text-sm mt-1">Create one for a trip, gift list, or weekend plan.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {boards.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => navigate(`/people/${groupId}/ideas/${b.id}`)}
                className="w-full text-left bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[14px] p-4 hover:bg-[var(--color-s2)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">{b.title}</p>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      b.status === 'decided'
                        ? 'bg-[color-mix(in_srgb,var(--color-ok)_20%,transparent)] text-[var(--color-ok)]'
                        : 'bg-[var(--color-s3)] text-[var(--color-dim)]'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-mute)] mt-1">
                  {b.idea_count ?? 0} ideas
                </p>
              </button>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // Single board
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate(`/people/${groupId}/ideas`)}
        className="flex items-center gap-2 text-sm text-[var(--color-dim)]"
      >
        <ArrowLeft size={16} /> Boards
      </button>

      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{board?.title || 'Board'}</h1>
          {board?.status === 'decided' && (
            <p className="text-xs font-bold text-[var(--color-ok)] mt-1">Decided</p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setSort('new')}
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              sort === 'new' ? 'bg-[var(--color-acc)] text-[var(--color-ink)]' : 'bg-[var(--color-s2)]'
            }`}
          >
            New
          </button>
          <button
            type="button"
            onClick={() => setSort('top')}
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              sort === 'top' ? 'bg-[var(--color-acc)] text-[var(--color-ink)]' : 'bg-[var(--color-s2)]'
            }`}
          >
            Top
          </button>
        </div>
      </header>

      {board?.status !== 'decided' && (
        <div className="bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[16px] p-3 space-y-2">
          <textarea
            value={ideaText}
            onChange={(e) => setIdeaText(e.target.value)}
            placeholder="Add an idea…"
            rows={2}
            className="w-full bg-transparent text-sm outline-none resize-none"
          />
          <input
            value={ideaLink}
            onChange={(e) => setIdeaLink(e.target.value)}
            placeholder="Link (optional)"
            className="w-full bg-[var(--color-s2)] border border-[var(--color-line)] rounded-full px-3 py-1.5 text-xs outline-none"
          />
          <button
            type="button"
            onClick={handleAddIdea}
            disabled={busy || !ideaText.trim()}
            className="w-full min-h-9 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] text-sm font-bold disabled:opacity-40"
          >
            Add idea
          </button>
        </div>
      )}

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : ideas.length === 0 ? (
        <div className="py-12 text-center text-[var(--color-dim)]">
          <p className="font-medium">No ideas yet</p>
          <p className="text-sm">Be the first — hotels, gifts, anything.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {ideas.map((idea) => {
            const isDecided = board?.decided_idea_id === idea.id
            return (
              <li
                key={idea.id}
                className={`bg-[var(--color-s1)] border rounded-[14px] p-4 ${
                  isDecided
                    ? 'border-[var(--color-ok)]'
                    : 'border-[var(--color-line2)]'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{idea.body}</p>
                {idea.link_url && (
                  <a
                    href={idea.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[var(--color-acc)] mt-1 inline-block"
                  >
                    {idea.link_title || idea.link_url}
                  </a>
                )}
                <div className="flex items-center justify-between mt-3">
                  <p className="text-[11px] text-[var(--color-mute)]">
                    {idea.author_name || 'Member'} ·{' '}
                    {formatDistanceToNow(new Date(idea.created_at), { addSuffix: true })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleReact(idea.id)}
                      className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                        idea.reacted
                          ? 'bg-[color-mix(in_srgb,var(--color-acc)_20%,transparent)] text-[var(--color-acc)]'
                          : 'bg-[var(--color-s2)] text-[var(--color-dim)]'
                      }`}
                    >
                      <ThumbsUp size={12} /> {idea.reactions}
                    </button>
                    {board?.status !== 'decided' && (
                      <button
                        type="button"
                        onClick={() => handleDecide(idea.id)}
                        className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-[var(--color-s2)] text-[var(--color-dim)]"
                        title="Mark as decision"
                      >
                        <Check size={12} /> Pick
                      </button>
                    )}
                    {isDecided && (
                      <span className="text-[10px] font-bold uppercase text-[var(--color-ok)]">
                        Chosen
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
