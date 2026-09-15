import { useCallback, useEffect, useState } from 'react'
import { Search, Plus, FileText, Sparkles } from 'lucide-react'
import {
  listSaves,
  createSave,
  deleteSave,
  toggleSaveListItem,
  addSaveListItem,
  updateSave,
  aiFindSaves,
  type SaveItem,
} from '@/lib/saves'
import { useToast } from '@/components/ui/Toast'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { TodayStrip } from '@/components/home/TodayStrip'
import { RetentionNudge } from '@/components/retention/RetentionNudge'
import { WelcomeBack } from '@/components/home/WelcomeBack'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { createTask } from '@/lib/tasks'
import { SaveCard } from '@/components/saves/SaveCard'
import { Sheet, SheetActions } from '@/components/ui/Sheet'
import { clsx } from 'clsx'

export function SavesPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<SaveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [kind, setKind] = useState<'link' | 'note' | 'place' | 'list'>('link')
  const [url, setUrl] = useState('')
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [collection, setCollection] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [aiMode, setAiMode] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listSaves()
      setItems(data)
    } catch (err: any) {
      setError(err.message || 'Could not load saves. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const { pulling, refreshing } = usePullToRefresh(async () => {
    await load()
  })

  async function runSearch(q: string, useAi: boolean) {
    const trimmed = q.trim()
    if (!trimmed) {
      setAiMode(false)
      return load()
    }
    setSearching(true)
    setError('')
    try {
      const data = await aiFindSaves(trimmed)
      setItems(data)
      setAiMode(useAi)
    } catch (err: any) {
      setError(err.message || 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim()) runSearch(query, true)
      else if (!query) load()
    }, 320)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function handleCreate() {
    if (busy) return
    if (kind === 'link' && !url.trim()) {
      toast('Paste a link', 'error')
      return
    }
    if (kind !== 'link' && !body.trim() && !title.trim()) {
      toast('Add a note', 'error')
      return
    }
    setBusy(true)
    try {
      await createSave({
        kind,
        url: kind === 'link' ? url.trim() : undefined,
        body: body.trim() || undefined,
        title: title.trim() || undefined,
        collection: collection.trim() || undefined,
      })
      setComposerOpen(false)
      setUrl('')
      setBody('')
      setTitle('')
      setCollection('')
      toast('Saved', 'success')
      await load()
    } catch (err: any) {
      toast(err.message || 'Could not save', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this save?')) return
    try {
      await deleteSave(id)
      setItems((prev) => prev.filter((x) => x.id !== id))
      toast('Deleted', 'success')
    } catch (err: any) {
      toast(err.message || 'Delete failed', 'error')
    }
  }

  async function handleCreateTaskFromSave(s: SaveItem) {
    try {
      const taskTitle =
        s.title?.trim() ||
        s.body?.trim().slice(0, 80) ||
        s.url?.replace(/^https?:\/\//, '').slice(0, 80) ||
        'From save'
      const task = await createTask({
        title: taskTitle,
        notes: [s.url, s.body].filter(Boolean).join('\n\n').slice(0, 500) || undefined,
      })
      toast(
        task.calendar_event_id
          ? 'Task created · on Plan'
          : 'Task created — add a due date on Tasks to sync Plan',
        'success'
      )
    } catch (err: any) {
      toast(err.message || 'Could not create task', 'error')
    }
  }

  return (
    <div className="space-y-4 page-enter">
      {(pulling || refreshing) && (
        <p className="text-center text-[11px] font-bold uppercase tracking-wider text-[var(--color-acc)]">
          {refreshing ? 'Refreshing…' : 'Release to refresh'}
        </p>
      )}
      <WelcomeBack />
      <TodayStrip />
      <RetentionNudge />

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.65rem] font-bold tracking-tight text-balance">Saves</h1>
          <p className="text-sm text-[var(--color-dim)] mt-1 text-pretty">
            Your notes, bookmarks, places and lists.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] border-2 border-[var(--color-ink)] text-sm font-bold shadow-[4px_4px_0_var(--color-ink)]"
        >
          <Plus size={18} aria-hidden />
          Save
        </button>
      </header>

      <div className="relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-mute)] pointer-events-none"
          aria-hidden
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search saves…"
          aria-label="Search saves"
          className="field !pl-10 !rounded-full"
        />
        {aiMode && query.trim() && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-acc2)]">
            <Sparkles size={12} aria-hidden /> Search
          </span>
        )}
      </div>

      {aiMode && query.trim() && (
        <p className="text-xs text-[var(--color-mute)] flex items-center gap-1.5">
          <Sparkles size={12} className="text-[var(--color-acc2)]" aria-hidden />
          Best matches for “{query.trim()}”
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]"
        >
          {error}
        </div>
      )}

      {loading || searching ? (
        <ListSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} />}
          title={query ? 'No matches' : 'Nothing saved yet'}
          description={
            query
              ? 'Try different words — Search matches titles, notes, links and list items.'
              : 'Paste a link or write a note so you can find it months later.'
          }
          action={
            !query ? (
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="min-h-11 px-5 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] text-sm font-bold"
              >
                Save something
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2.5" aria-label="Saved items">
          {items.map((s) => (
            <li key={s.id}>
              <SaveCard
                save={s}
                onDelete={handleDelete}
                onCreateTask={handleCreateTaskFromSave}
              />
              <button type="button" className="btn-ghost text-sm" onClick={async () => {
                const title = window.prompt('Title', s.title || ''); if (title === null) return;
                const body = window.prompt('Notes', s.body || ''); if (body === null) return;
                try { await updateSave(s.id, {title, body}, s.updated_at || (s.created_at === '1970-01-01T00:00:00.000Z' ? '' : s.created_at)); await load() } catch (e: any) { toast(e.message || 'Could not update', 'error') }
              }}>Edit</button>
              {s.kind === 'list' && <button type="button" className="btn-ghost text-sm" onClick={async()=>{const text=window.prompt('New list item');if(!text?.trim())return;try{await addSaveListItem(s.id,text);await load()}catch(e:any){toast(e.message || 'Could not add item','error')}}}>Add item</button>}
              {s.kind === 'list' && <ul className="px-4 pb-3">{(s.items || []).map(item => <li key={item.id}><label className="flex gap-2 items-center py-2"><input type="checkbox" checked={item.done} onChange={async () => {try {await toggleSaveListItem(s.id,item.id);await load()} catch(e:any){toast(e.message || 'Could not update list','error')}}}/><span>{item.text}</span></label></li>)}</ul>}
            </li>
          ))}
        </ul>
      )}

      {composerOpen && (
        <Sheet
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          title="New save"
          titleId="save-composer-title"
        >
            <div
              className="flex gap-1 p-1 rounded-full bg-[var(--color-s2)] border border-[var(--color-line2)]"
              role="tablist"
              aria-label="Save type"
            >
              {(['link', 'note', 'place', 'list'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kind === k}
                  onClick={() => setKind(k)}
                  className={clsx(
                    'flex-1 py-2 rounded-full text-sm font-bold capitalize min-h-10 transition-colors',
                    kind === k
                      ? 'bg-[var(--color-acc)] text-[var(--color-ink)]'
                      : 'text-[var(--color-dim)] hover:text-[var(--color-txt)]'
                  )}
                >
                  {k}
                </button>
              ))}
            </div>

            {kind === 'link' && (
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                className="field"
              />
            )}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              className="field"
              autoFocus={kind === 'note'}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                kind === 'link'
                  ? 'Why did you save this? (helps find it later)'
                  : 'Your note…'
              }
              rows={3}
              className="field !min-h-[5.5rem] resize-none py-3"
            />
            <input
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              placeholder="Collection (e.g. Work, Recipes)"
              className="field"
            />
            <SheetActions>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="flex-1 min-h-11 rounded-full border border-[var(--color-line)] text-sm font-bold text-[var(--color-dim)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={busy}
                className="flex-1 min-h-11 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] border-2 border-[var(--color-ink)] font-bold disabled:opacity-50 shadow-[4px_4px_0_var(--color-ink)]"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </SheetActions>
        </Sheet>
      )}
    </div>
  )
}
