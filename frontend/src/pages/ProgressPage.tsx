import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Post } from '@/types'
import { createPost } from '@/lib/posts'
import { useToast } from '@/components/ui/Toast'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDistanceToNow } from 'date-fns'
import { Send, CheckSquare } from 'lucide-react'
import { createTask } from '@/lib/tasks'
import { clsx } from 'clsx'

/** Progress = sparse accountability updates (not a social feed) */
export function ProgressPage() {
  const { toast } = useToast()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [privacy, setPrivacy] = useState<'private' | 'group' | 'circle'>('private')
  const [selectedGroup,setSelectedGroup]=useState('')
  const [groups,setGroups]=useState<{id:string;name:string;status:string}[]>([])
  useEffect(()=>{supabase.rpc('daybook_groups').then(({data,error})=>{if(!error)setGroups((data||[]).filter((g:{status:string})=>g.status==='active'))})},[])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('daybook_feed')
      if (error) throw error
      const list = (data || []) as Post[]
      setPosts(list.slice(0, 40))
      setError('')
    } catch (err: any) {
      setError(err.message || 'Could not load progress')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function saveAsTask() {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      await createTask({ title: text.trim().slice(0, 120) })
      toast('Saved as task — add a due date on Tasks to show on Plan', 'success')
      setText('')
    } catch (err: any) {
      toast(err.message || 'Could not create task', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      if(privacy==='group'&&!selectedGroup)throw Error('Choose an approved group first')
      await createPost(text.trim(), { mood: '✅', privacy, groupId:selectedGroup||null })
      setText('')
      toast('Progress shared', 'success')
      await load()
    } catch (err: any) {
      toast(err.message || 'Failed to post', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 page-enter">
      <header>
        <h1 className="text-[1.65rem] font-bold tracking-tight text-balance">Progress</h1>
        <p className="text-sm text-[var(--color-dim)] mt-1 text-pretty">
          What moved forward — for you and people you trust.
        </p>
      </header>

      <div className="surface-elevated p-4 space-y-3">
        <label className="sr-only" htmlFor="progress-text">
          Progress update
        </label>
        <textarea
          id="progress-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What moved forward today?"
          rows={2}
          className="w-full bg-transparent resize-none outline-none text-sm placeholder:text-[var(--color-mute)] min-h-[3rem]"
        />
        <p className="text-[11px] text-[var(--color-mute)]">
          Private = only you · Circle = trusted people · Group = groups you share with
        </p>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as typeof privacy)}
            aria-label="Who can see this update"
            className="bg-[var(--color-s2)] border border-[var(--color-line)] rounded-full px-3 py-1.5 text-xs font-bold min-h-9"
          >
            <option value="private">Only me</option>
            <option value="circle">Family</option>
            <option value="group">Group</option>
          </select>
          {privacy==='group'&&<select aria-label="Destination group" className="field" value={selectedGroup} onChange={e=>setSelectedGroup(e.target.value)}><option value="">Choose group</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={saveAsTask}
              disabled={!text.trim() || busy}
              className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-full border border-[var(--color-line)] text-[var(--color-acc)] text-xs font-bold disabled:opacity-40"
            >
              <CheckSquare size={14} aria-hidden /> As task
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim() || busy}
              className="inline-flex items-center gap-1.5 min-h-10 px-4 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] border-2 border-[var(--color-ink)] text-sm font-bold disabled:opacity-40 shadow-[4px_4px_0_var(--color-ink)]"
            >
              <Send size={14} aria-hidden /> Share
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]"
        >
          {error}
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl" aria-hidden>✅</span>}
          title="No progress yet"
          description="Share one line when something moves — keep it sparse and honest."
        />
      ) : (
        <ul className="space-y-2.5" aria-label="Progress updates">
          {posts.map((p) => (
            <li key={p.id}>
              <article className="surface-elevated p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-9 h-9 rounded-full bg-[color-mix(in_srgb,var(--color-acc)_15%,var(--color-s3))] flex items-center justify-center text-xs font-bold text-[var(--color-acc)]"
                    aria-hidden
                  >
                    {(p.author?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{p.author || 'Someone'}</p>
                    <p className="text-[11px] text-[var(--color-mute)]">
                      {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                      {' · '}
                      <span
                        className={clsx(
                          'font-semibold',
                          p.privacy === 'private' || p.privacy === 'me'
                            ? 'text-[var(--color-mute)]'
                            : 'text-[var(--color-dim)]'
                        )}
                      >
                        {p.privacy === 'private' || p.privacy === 'me'
                          ? 'Only them'
                          : p.privacy === 'circle'
                            ? 'Family'
                            : 'Group'}
                      </span>
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-pretty">
                  {p.mood && (
                    <span className="mr-1.5" aria-hidden>
                      {p.mood}
                    </span>
                  )}
                  {p.text}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
