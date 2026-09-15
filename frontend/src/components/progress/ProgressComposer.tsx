import { useState, useEffect } from 'react'
import { X, Loader2, User, Users, Home } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createProgressPost, type ProgressAudience } from '@/lib/progress'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Group } from '@/types'

interface ProgressComposerProps {
  open: boolean
  onClose: () => void
  defaultGroupId?: string
}

export function ProgressComposer({ open, onClose, defaultGroupId }: ProgressComposerProps) {
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<ProgressAudience>(defaultGroupId ? 'group' : 'me')
  const [groupId, setGroupId] = useState<string>(defaultGroupId || '')
  const [groups, setGroups] = useState<Group[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let mounted = true
    async function load() {
      try {
        const { data } = await supabase.rpc('daybook_groups')
        if (mounted) {
          const active = ((data as Group[]) || []).filter((g) => g.status === 'active')
          setGroups(active)
          if (defaultGroupId) {
            setGroupId(defaultGroupId)
            setAudience('group')
          } else if (active.length && !groupId) {
            // leave groupId empty until user picks
          }
        }
      } catch {
        // groups optional for "me" posts
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [open, defaultGroupId])

  const mutation = useMutation({
    mutationFn: () =>
      createProgressPost({
        body,
        audience,
        group_id: audience === 'me' ? null : groupId || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress'] })
      setBody('')
      setError('')
      setAudience(defaultGroupId ? 'group' : 'me')
      onClose()
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to post')
    },
  })

  if (!open) return null

  const needsGroup = audience === 'group' || audience === 'family'
  const canSubmit = body.trim().length > 0 && (!needsGroup || Boolean(groupId))

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-[var(--color-s1)] border-[1.5px] border-[var(--color-line)] rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] shadow-[var(--shadow-elevated)] max-h-[90dvh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-[var(--color-line2)] bg-[var(--color-s1)] z-10">
          <h2 className="font-bold text-lg">Share Progress</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[var(--color-s2)] text-[var(--color-mute)]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What moved forward? Keep it short and calm…"
            rows={4}
            maxLength={500}
            className="w-full px-4 py-3 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-[var(--color-txt)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-[var(--color-acc)]/40 resize-none"
            autoFocus
          />
          <div className="text-right text-[11px] text-[var(--color-mute)]">{body.length}/500</div>

          {/* Audience */}
          <div>
            <div className="text-xs font-semibold text-[var(--color-dim)] mb-2 uppercase tracking-wide">
              Who can see this
            </div>
            <div className="flex gap-2 p-1 rounded-xl bg-[var(--color-s2)]">
              {(
                [
                  { id: 'me' as const, icon: User, label: 'Only me' },
                  { id: 'group' as const, icon: Users, label: 'Group' },
                  { id: 'family' as const, icon: Home, label: 'Family' },
                ] as const
              ).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAudience(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    audience === id
                      ? 'bg-[var(--color-acc)] text-[var(--color-ink)]'
                      : 'text-[var(--color-dim)] hover:text-[var(--color-txt)]'
                  }`}
                >
                  <Icon size={15} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {needsGroup && (
            <div>
              <label className="text-xs font-semibold text-[var(--color-dim)] mb-2 block uppercase tracking-wide">
                Choose {audience === 'family' ? 'family' : 'group'}
              </label>
              {groups.length === 0 ? (
                <p className="text-sm text-[var(--color-mute)]">
                  No active groups yet. Create one under People.
                </p>
              ) : (
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--color-s2)] border border-[var(--color-line)] text-sm outline-none focus:border-[var(--color-acc)]"
                >
                  <option value="">Select…</option>
                  {groups
                    .filter((g) => (audience === 'family' ? g.kind === 'family' : true))
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              )}
            </div>
          )}

          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => mutation.mutate()}
              disabled={!canSubmit || mutation.isPending}
              leftIcon={mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : undefined}
            >
              {mutation.isPending ? 'Posting…' : 'Post'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
