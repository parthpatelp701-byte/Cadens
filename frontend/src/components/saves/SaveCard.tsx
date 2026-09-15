import { Link2, FileText, Trash2, ExternalLink, CheckSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { clsx } from 'clsx'
import type { SaveItem } from '@/lib/saves'

export interface SaveCardProps {
  save: SaveItem
  onDelete: (id: string) => void
  onCreateTask: (save: SaveItem) => void
}

export function SaveCard({ save: s, onDelete, onCreateTask }: SaveCardProps) {
  return (
    <article className="group surface-elevated p-3.5 flex gap-3 transition-colors hover:border-[var(--color-line)]">
      <div
        className={clsx(
          'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border',
          s.kind === 'link'
            ? 'bg-[color-mix(in_srgb,var(--color-acc)_12%,var(--color-s2))] border-[color-mix(in_srgb,var(--color-acc)_20%,transparent)] text-[var(--color-acc)]'
            : 'bg-[color-mix(in_srgb,var(--color-acc3)_12%,var(--color-s2))] border-[color-mix(in_srgb,var(--color-acc3)_20%,transparent)] text-[var(--color-acc3)]'
        )}
        aria-hidden
      >
        {s.kind === 'link' ? <Link2 size={18} /> : <FileText size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-sm tracking-tight truncate">
          {s.title || s.body?.slice(0, 60) || 'Untitled'}
        </h2>
        {s.ai_summary ? (
          <p className="text-xs text-[var(--color-dim)] mt-1 line-clamp-2 text-pretty">
            {s.ai_summary}
          </p>
        ) : s.body ? (
          <p className="text-xs text-[var(--color-dim)] mt-1 line-clamp-2">{s.body}</p>
        ) : null}
        <p className="text-[11px] text-[var(--color-mute)] mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
          {s.domain && <span className="truncate max-w-[10rem]">{s.domain}</span>}
          {s.collection && (
            <span className="inline-flex items-center rounded-full bg-[var(--color-s2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-dim)]">
              {s.collection}
            </span>
          )}
          <span>{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</span>
        </p>
        <div className="flex flex-wrap gap-1 mt-2.5">
          {s.url && (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 min-h-9 px-2.5 rounded-full text-xs font-bold text-[var(--color-acc)] hover:bg-[color-mix(in_srgb,var(--color-acc)_12%,transparent)]"
            >
              <ExternalLink size={12} aria-hidden /> Open
            </a>
          )}
          <button
            type="button"
            onClick={() => onCreateTask(s)}
            className="inline-flex items-center gap-1 min-h-9 px-2.5 rounded-full text-xs font-bold text-[var(--color-acc)] hover:bg-[color-mix(in_srgb,var(--color-acc)_12%,transparent)]"
          >
            <CheckSquare size={12} aria-hidden /> Task
          </button>
          <button
            type="button"
            onClick={() => onDelete(s.id)}
            className="inline-flex items-center gap-1 min-h-9 px-2.5 rounded-full text-xs font-bold text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] sm:opacity-80 sm:group-hover:opacity-100"
          >
            <Trash2 size={12} aria-hidden /> Delete
          </button>
        </div>
      </div>
    </article>
  )
}
