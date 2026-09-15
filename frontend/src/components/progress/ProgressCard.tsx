import { Trash2, User, Users, Home } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { ProgressPost } from '@/types'
import { Card } from '@/components/ui/Card'
import { clsx } from 'clsx'
import { useAuth } from '@/hooks/useAuth'

interface ProgressCardProps {
  post: ProgressPost
  onDelete?: (id: string) => void
  deleting?: boolean
  groupName?: string
}

const audienceMeta = {
  me: { label: 'Only me', icon: User },
  group: { label: 'Group', icon: Users },
  family: { label: 'Family', icon: Home },
} as const

export function ProgressCard({ post, onDelete, deleting, groupName }: ProgressCardProps) {
  const { user } = useAuth()
  const isMine = user?.id === post.author_id
  const meta = audienceMeta[post.audience] || audienceMeta.me
  const Icon = meta.icon

  return (
    <Card className="group" padding={false}>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-acc)]/25 to-[var(--color-acc2)]/25 flex items-center justify-center shrink-0">
            <Icon size={16} className="text-[var(--color-acc)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap">{post.body}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-2 text-[11px] text-[var(--color-mute)]">
              <span>
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Icon size={11} />
                {post.audience === 'me'
                  ? 'Only me'
                  : groupName || meta.label}
              </span>
            </div>
          </div>
          {isMine && onDelete && (
            <button
              onClick={() => onDelete(post.id)}
              disabled={deleting}
              className={clsx(
                'opacity-0 group-hover:opacity-100 focus:opacity-100 p-2 rounded-lg transition-opacity',
                'text-[var(--color-mute)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
              )}
              aria-label="Delete progress"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
