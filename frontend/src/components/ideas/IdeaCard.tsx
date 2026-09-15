import { ExternalLink, Check, Flame, Heart, ThumbsUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { IdeaWithReactions, ReactionKind } from '@/lib/ideas'
import { Card } from '@/components/ui/Card'
import { clsx } from 'clsx'

interface IdeaCardProps {
  idea: IdeaWithReactions
  isDecided?: boolean
  boardOpen?: boolean
  onReact?: (ideaId: string, kind: ReactionKind) => void
  onMarkDecided?: (ideaId: string) => void
  reacting?: boolean
}

const REACTIONS: { kind: ReactionKind; icon: typeof ThumbsUp; label: string }[] = [
  { kind: 'up', icon: ThumbsUp, label: 'Up' },
  { kind: 'heart', icon: Heart, label: 'Love' },
  { kind: 'fire', icon: Flame, label: 'Fire' },
]

export function IdeaCard({
  idea,
  isDecided,
  boardOpen = true,
  onReact,
  onMarkDecided,
  reacting,
}: IdeaCardProps) {
  return (
    <Card
      className={clsx(
        'group transition-colors',
        isDecided && 'ring-2 ring-[var(--color-acc)]/50 bg-[color-mix(in_srgb,var(--color-acc)_8%,var(--color-s2))]'
      )}
      padding={false}
    >
      <div className="p-4 space-y-3">
        {isDecided && (
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-acc)]">
            <Check size={14} />
            Decided
          </div>
        )}

        <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap">{idea.body}</p>

        {idea.link_url && (
          <a
            href={idea.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-acc)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
            <span className="truncate max-w-[240px]">
              {idea.link_title || idea.link_url.replace(/^https?:\/\//, '')}
            </span>
          </a>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1">
            {REACTIONS.map(({ kind, icon: Icon, label }) => {
              const active = idea.my_reaction === kind
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={reacting || !boardOpen}
                  onClick={() => onReact?.(idea.id, kind)}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors',
                    active
                      ? 'bg-[var(--color-acc)]/20 text-[var(--color-acc)]'
                      : 'text-[var(--color-mute)] hover:bg-[var(--color-s3)] hover:text-[var(--color-txt)]',
                    !boardOpen && 'opacity-50 cursor-default'
                  )}
                  aria-label={label}
                  title={label}
                >
                  <Icon size={14} strokeWidth={active ? 2.5 : 2} />
                </button>
              )
            })}
            {idea.reaction_count > 0 && (
              <span className="text-[11px] text-[var(--color-mute)] ml-1 tabular-nums">
                {idea.reaction_count}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--color-mute)]">
              {formatDistanceToNow(new Date(idea.created_at), { addSuffix: true })}
            </span>
            {boardOpen && onMarkDecided && (
              <button
                type="button"
                onClick={() => onMarkDecided(idea.id)}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[11px] font-semibold text-[var(--color-acc)] hover:underline transition-opacity"
              >
                Decide
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
