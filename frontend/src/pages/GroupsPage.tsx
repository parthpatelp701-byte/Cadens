import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Group } from '@/types'
import { Users, Plus, LogIn, Trash2, RefreshCw, Check, X, MessageCircle } from 'lucide-react'
import { startConversation, startGroupConversation, createGroupConversation } from '@/lib/messages'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { ListSkeleton } from '@/components/ui/Skeleton'

export function GroupsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'group' | 'family'>('group')
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function loadGroups() {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('daybook_groups')
      if (error) throw error
      setGroups(data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load groups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  async function runAction(action: string, target?: string, memberId?: string) {
    setBusy(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('daybook_group_action', {
        action,
        target: target || null,
        member_id: memberId || null,
        label: name,
        invite_code: inviteCode,
        group_kind: kind,
      })
      if (error) throw error
      setGroups(data || [])
      setName('')
      setInviteCode('')
    } catch (err: any) {
      setError(err.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function messageMember(memberId: string) {
    if (!memberId || memberId === user?.id) return
    setBusy(true)
    try {
      const convId = await startConversation(memberId)
      navigate('/messages', { state: { openConversationId: convId } })
    } catch (err: any) {
      const msg = err.message || 'Could not start chat. Run the Messages SQL migration first.'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function openGroupChat(g: Group) {
    setBusy(true)
    setError('')
    try {
      // Prefer dedicated group conversation RPC; fall back to creating with active members
      let convId: string
      try {
        convId = await startGroupConversation(g.id)
      } catch {
        const memberIds = (g.members || [])
          .filter((m) => m.status === 'active' && m.id !== user?.id)
          .map((m) => m.id)
        if (memberIds.length === 0) {
          throw new Error('No other active members to chat with')
        }
        convId = await createGroupConversation(g.name, memberIds)
      }
      navigate('/messages', { state: { openConversationId: convId } })
      toast('Opened group chat', 'success')
    } catch (err: any) {
      const msg =
        err.message ||
        'Could not open group chat. Run SQL 05-group-chats.sql after messages migration.'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  const activeGroups = groups.filter((g) => g.status === 'active')
  const pendingGroups = groups.filter((g) => g.status === 'pending')

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">People</h1>
        <p className="text-sm text-[var(--color-dim)]">Groups & family — plan ideas and share progress</p>
      </header>

      {error && (
        <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <section className="bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[16px] p-4 space-y-3">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Plus size={16} /> Create a space
        </h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Family grind, Project Alpha…"
          maxLength={80}
          className="w-full bg-[var(--color-s2)] border border-[var(--color-line)] rounded-[12px] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-acc)]"
        />
        <div className="flex gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'group' | 'family')}
            className="bg-[var(--color-s2)] border border-[var(--color-line)] rounded-[12px] px-3 py-2 text-sm"
          >
            <option value="group">Group</option>
            <option value="family">Family</option>
          </select>
          <button
            disabled={!name.trim() || busy}
            onClick={() => runAction('create')}
            className="flex-1 min-h-10 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] text-sm font-bold disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </section>

      <section className="bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[16px] p-4 space-y-3">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <LogIn size={16} /> Join with invite code
        </h2>
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder="C-…"
          maxLength={32}
          className="w-full bg-[var(--color-s2)] border border-[var(--color-line)] rounded-[12px] px-3.5 py-2.5 text-sm uppercase outline-none focus:border-[var(--color-acc)]"
        />
        <button
          disabled={!inviteCode.trim() || busy}
          onClick={() => runAction('join')}
          className="w-full min-h-10 rounded-full border border-[var(--color-line)] text-sm font-bold disabled:opacity-40"
        >
          Request to join
        </button>
        <p className="text-xs text-[var(--color-mute)]">Join requests need owner approval.</p>
      </section>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : (
        <>
          {pendingGroups.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-dim)]">Waiting for approval</h2>
              {pendingGroups.map((g) => (
                <div key={g.id} className="bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[14px] p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold">{g.name}</p>
                    <p className="text-xs text-[var(--color-dim)]">Pending</p>
                  </div>
                  <button onClick={() => runAction('leave', g.id)} className="text-xs font-bold text-[var(--color-danger)]">
                    Cancel
                  </button>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-dim)]">
              Your spaces ({activeGroups.length})
            </h2>

            {activeGroups.length === 0 ? (
              <div className="py-12 text-center text-[var(--color-dim)]">
                <Users size={32} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium">No active groups yet</p>
                <p className="text-sm mt-1">Create one or join with a code.</p>
              </div>
            ) : (
              activeGroups.map((g) => (
                <div key={g.id} className="bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[16px] overflow-hidden">
                  <div className="p-4 flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/people/${g.id}`)}
                      className="text-left min-w-0"
                    >
                      <p className="font-bold hover:underline">{g.name}</p>
                      <p className="text-xs text-[var(--color-dim)] mt-0.5">
                        {g.kind === 'family' ? 'Family' : 'Group'} · Code:{' '}
                        <span className="font-mono">{g.code}</span>
                      </p>
                    </button>
                    <div className="flex gap-1">
                      <button
                        title="Group chat"
                        onClick={() => openGroupChat(g)}
                        disabled={busy}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-acc)] hover:bg-[color-mix(in_srgb,var(--color-acc)_12%,transparent)]"
                      >
                        <MessageCircle size={16} />
                      </button>
                      <button
                        title="Rotate invite code"
                        onClick={() => {
                          if (confirm('Replace the invite code? Old code will stop working.')) {
                            runAction('rotate', g.id)
                          }
                        }}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-dim)] hover:bg-[var(--color-s2)]"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        title="Delete group"
                        onClick={() => {
                          if (confirm('Delete this group and revoke shared access?')) {
                            runAction('delete', g.id)
                          }
                        }}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)]"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {g.members && g.members.length > 0 && (
                    <div className="border-t border-[var(--color-line2)] px-4 py-3 space-y-2">
                      <p className="text-xs font-bold text-[var(--color-dim)] mb-1">Members</p>
                      {g.members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-[var(--color-s3)] flex items-center justify-center text-xs font-bold shrink-0">
                              {(m.name?.[0] || '?').toUpperCase()}
                            </div>
                            <span className="font-medium truncate">{m.name}</span>
                            <span className="text-xs text-[var(--color-mute)] shrink-0">{m.role}</span>
                            {m.status === 'pending' && (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-warn)] bg-[color-mix(in_srgb,var(--color-warn)_15%,transparent)] px-1.5 py-0.5 rounded shrink-0">
                                Pending
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {m.status === 'active' && m.id !== user?.id && (
                              <button
                                title="Message"
                                onClick={() => messageMember(m.id)}
                                disabled={busy}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-acc)] hover:bg-[color-mix(in_srgb,var(--color-acc)_12%,transparent)]"
                              >
                                <MessageCircle size={16} />
                              </button>
                            )}
                            {m.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => runAction('approve', g.id, m.id)}
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-ok)] hover:bg-[color-mix(in_srgb,var(--color-ok)_12%,transparent)]"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={() => runAction('remove', g.id, m.id)}
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)]"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            )}
                            {m.status === 'active' && m.role !== 'Owner' && (
                              <button
                                onClick={() => {
                                  if (confirm(`Remove ${m.name}?`)) runAction('remove', g.id, m.id)
                                }}
                                className="text-xs font-bold text-[var(--color-danger)] ml-1"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  )
}
