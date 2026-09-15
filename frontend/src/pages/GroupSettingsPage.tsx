import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Group } from '@/types'
import { ArrowLeft, RefreshCw, Trash2, MessageCircle, Users, Lightbulb } from 'lucide-react'
import { startGroupConversation, createGroupConversation } from '@/lib/messages'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { ListSkeleton } from '@/components/ui/Skeleton'

export function GroupSettingsPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('daybook_groups')
      if (error) throw error
      const g = (data || []).find((x: Group) => x.id === groupId) || null
      setGroup(g)
      if (!g) setError('Group not found or you are not a member')
    } catch (err: any) {
      setError(err.message || 'Failed to load group')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [groupId])

  async function runAction(action: string, memberId?: string) {
    if (!group) return
    setBusy(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('daybook_group_action', {
        action,
        target: group.id,
        member_id: memberId || null,
        label: group.name,
        invite_code: null,
        group_kind: group.kind,
      })
      if (error) throw error
      const updated = (data || []).find((x: Group) => x.id === group.id)
      setGroup(updated || null)
      toast('Updated', 'success')
      if (action === 'delete' || action === 'leave') {
        navigate('/people')
      }
    } catch (err: any) {
      const msg = err.message || 'Action failed'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function openChat() {
    if (!group) return
    setBusy(true)
    try {
      let convId: string
      try {
        convId = await startGroupConversation(group.id)
      } catch {
        const memberIds = (group.members || [])
          .filter((m) => m.status === 'active' && m.id !== user?.id)
          .map((m) => m.id)
        if (!memberIds.length) throw new Error('No other members')
        convId = await createGroupConversation(group.name, memberIds)
      }
      navigate('/messages', { state: { openConversationId: convId } })
    } catch (err: any) {
      toast(err.message || 'Could not open chat', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <ListSkeleton rows={4} />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/people')}
          className="flex items-center gap-2 text-sm text-[var(--color-dim)]"
        >
          <ArrowLeft size={16} /> Back to groups
        </button>
        <p className="text-[var(--color-danger)]">{error || 'Group not found'}</p>
      </div>
    )
  }

  const isOwner = group.ownerId === user?.id || group.members?.some(
    (m) => m.id === user?.id && m.role === 'Owner'
  )

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate('/people')}
        className="flex items-center gap-2 text-sm text-[var(--color-dim)] hover:text-[var(--color-txt)]"
      >
        <ArrowLeft size={16} /> Groups
      </button>

      <header>
        <h1 className="text-xl font-bold tracking-tight">{group.name}</h1>
        <p className="text-sm text-[var(--color-dim)]">
          {group.kind === 'family' ? 'Family' : 'Group'} · Code{' '}
          <span className="font-mono">{group.code || '—'}</span>
        </p>
      </header>

      {error && (
        <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate(`/people/${group.id}/ideas`)}
          className="flex items-center gap-2 min-h-10 px-4 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] text-sm font-bold"
        >
          <Lightbulb size={16} /> Idea boards
        </button>
        <button
          type="button"
          onClick={openChat}
          disabled={busy}
          className="flex items-center gap-2 min-h-10 px-4 rounded-full border border-[var(--color-line)] text-sm font-bold disabled:opacity-50"
        >
          <MessageCircle size={16} /> Group chat
        </button>
        {isOwner && (
          <button
            type="button"
            onClick={() => {
              if (confirm('Replace the invite code? Old code will stop working.')) {
                runAction('rotate')
              }
            }}
            disabled={busy}
            className="flex items-center gap-2 min-h-10 px-4 rounded-full border border-[var(--color-line)] text-sm font-bold"
          >
            <RefreshCw size={16} /> Rotate code
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm(isOwner ? 'Delete this group?' : 'Leave this group?')) {
              runAction(isOwner ? 'delete' : 'leave')
            }
          }}
          disabled={busy}
          className="flex items-center gap-2 min-h-10 px-4 rounded-full border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] text-[var(--color-danger)] text-sm font-bold"
        >
          <Trash2 size={16} /> {isOwner ? 'Delete' : 'Leave'}
        </button>
      </div>

      <section className="bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[16px] p-4 space-y-3">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Users size={16} /> Members ({group.members?.length || 0})
        </h2>
        {(group.members || []).length === 0 ? (
          <p className="text-sm text-[var(--color-dim)]">No members listed</p>
        ) : (
          (group.members || []).map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[var(--color-s3)] flex items-center justify-center text-xs font-bold shrink-0">
                  {(m.name?.[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.name}</p>
                  <p className="text-[11px] text-[var(--color-mute)]">
                    {m.role} · {m.status}
                  </p>
                </div>
              </div>
              {isOwner && m.status === 'pending' && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => runAction('approve', m.id)}
                    className="text-xs font-bold text-[var(--color-ok)] px-2 py-1"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction('remove', m.id)}
                    className="text-xs font-bold text-[var(--color-danger)] px-2 py-1"
                  >
                    Reject
                  </button>
                </div>
              )}
              {isOwner && m.status === 'active' && m.id !== user?.id && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remove ${m.name}?`)) runAction('remove', m.id)
                  }}
                  className="text-xs font-bold text-[var(--color-danger)] px-2 py-1"
                >
                  Remove
                </button>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  )
}
