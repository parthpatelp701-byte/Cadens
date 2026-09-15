import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
  registerServiceWorker,
} from '@/lib/push'
import { Bell, BellOff, MessageCircle, LogOut, BookOpen, Calendar, CheckSquare, Shield, FileText, Trash2, Download } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { startConversation } from '@/lib/messages'
import { buildUserExport, downloadJson } from '@/lib/exportData'
import { useToast } from '@/components/ui/Toast'
import {
  fetchGithubDna,
  saveGithubUsername,
  cacheGithubDna,
  setGithubVisible,
  getMyBuilderDna,
  disconnectGithubDna,
  tierLabel,
} from '@/lib/githubDna'

const githubEnabled = import.meta.env.VITE_ENABLE_GITHUB_DNA === 'true'
const pushEnabled = import.meta.env.VITE_ENABLE_PWA === 'true' && !!import.meta.env.VITE_VAPID_PUBLIC_KEY

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const { userId } = useParams<{ userId?: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('default')
  const [ghUser, setGhUser] = useState('')
  const [ghTier, setGhTier] = useState<string | null>(null)
  const [ghBio, setGhBio] = useState<string | null>(null)
  const [ghBusy, setGhBusy] = useState(false)
  const [ghVisible, setGhVisible] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  const [msgBusy, setMsgBusy] = useState(false)

  useEffect(() => {
    let ok = true
    if (!githubEnabled) return
    getMyBuilderDna()
      .then((d) => {
        if (!ok) return
        if (d.username) setGhUser(d.username)
        if (d.tier) setGhTier(d.tier)
        if (d.bio_line) setGhBio(d.bio_line)
        setGhVisible(!!d.visible)
      })
      .catch(() => {})
    return () => {
      ok = false
    }
  }, [])

  const isSelf = !userId || userId === user?.id
  const displayName = isSelf
    ? user?.email?.split('@')[0] || 'You'
    : `Member ${userId?.slice(0, 8) || ''}`

  useEffect(() => {
    if (!isSelf || !pushEnabled) return
    registerServiceWorker().catch(() => {})
    isPushSupported().then((ok) => {
      if (!ok) setPerm('unsupported')
      else getNotificationPermission().then(setPerm)
    })
  }, [isSelf])

  async function enablePush() {
    setPushBusy(true)
    setPushMsg('')
    try {
      await subscribeToPush()
      setPerm('granted')
      setPushMsg('Push notifications enabled')
      toast('Push notifications enabled', 'success')
    } catch (err: any) {
      setPushMsg(err.message || 'Could not enable notifications')
      toast(err.message || 'Could not enable notifications', 'error')
    } finally {
      setPushBusy(false)
    }
  }

  async function disablePush() {
    setPushBusy(true)
    setPushMsg('')
    try {
      await unsubscribeFromPush()
      setPerm('default')
      setPushMsg('Push notifications disabled')
      toast('Push notifications disabled', 'info')
    } catch (err: any) {
      setPushMsg(err.message || 'Could not disable')
      toast(err.message || 'Could not disable', 'error')
    } finally {
      setPushBusy(false)
    }
  }

  async function handleMessage() {
    if (!userId || isSelf || msgBusy) return
    setMsgBusy(true)
    try {
      const convId = await startConversation(userId)
      navigate('/messages', { state: { openConversationId: convId } })
    } catch (err: any) {
      toast(err.message || 'Could not start chat', 'error')
    } finally {
      setMsgBusy(false)
    }
  }

  async function handleExport() {
    try {
      const data = await buildUserExport()
      downloadJson(`cadens-export-${new Date().toISOString().slice(0, 10)}.json`, data)
      toast('Export downloaded', 'success')
    } catch (e: any) {
      toast(e.message || 'Export failed', 'error')
    }
  }

  return (

    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight">{isSelf ? 'You' : 'Member'}</h1>
        {isSelf && <p className="text-sm text-[var(--color-dim)]">{user?.email}</p>}
      </header>

      <div className="bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[16px] p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-acc)] flex items-center justify-center text-[var(--color-ink)] text-2xl font-bold">
            {(displayName[0] || 'U').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg truncate">{displayName}</p>
            {isSelf && (
              <p className="text-sm text-[var(--color-dim)]">
                Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
              </p>
            )}
          </div>
        </div>

        {!isSelf && (
          <button
            type="button"
            onClick={handleMessage}
            disabled={msgBusy}
            className="mt-4 w-full flex items-center justify-center gap-2 min-h-11 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] text-sm font-bold disabled:opacity-50"
          >
            <MessageCircle size={18} />
            {msgBusy ? 'Opening…' : 'Message'}
          </button>
        )}
      </div>

      {isSelf && (
        <>
          {pushEnabled && <>
          <div className="bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[16px] p-5 space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Bell size={16} /> Notifications
            </h2>
            <p className="text-sm text-[var(--color-dim)]">
              Get alerts for likes, comments, and messages even when Cadens is closed.
            </p>

            {perm === 'unsupported' ? (
              <p className="text-xs text-[var(--color-mute)]">Push is not supported in this browser.</p>
            ) : perm === 'granted' ? (
              <button
                type="button"
                onClick={disablePush}
                disabled={pushBusy}
                className="flex items-center gap-2 min-h-10 px-4 rounded-full border border-[var(--color-line)] text-sm font-bold"
              >
                <BellOff size={16} /> Disable push
              </button>
            ) : (
              <button
                type="button"
                onClick={enablePush}
                disabled={pushBusy}
                className="flex items-center gap-2 min-h-10 px-4 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] text-sm font-bold disabled:opacity-50"
              >
                <Bell size={16} /> {pushBusy ? 'Enabling…' : 'Enable push notifications'}
              </button>
            )}

            {pushMsg && <p className="text-xs text-[var(--color-dim)]">{pushMsg}</p>}
            <p className="text-[11px] text-[var(--color-mute)]">
              Requires VITE_VAPID_PUBLIC_KEY in your env and the push SQL migration. Sending pushes needs a small server or Supabase Edge Function with the VAPID private key.
            </p>
          </div>

          

          </>}

          {githubEnabled && <>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-mute)] px-1">
            Builder DNA
          </p>
          <div className="bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[16px] p-4 space-y-3">
            <p className="text-xs text-[var(--color-dim)] text-pretty">
              Optional public GitHub signal — not a clone of GitHub. Private repos never leave GitHub.
            </p>
            <input
              value={ghUser}
              onChange={(e) => setGhUser(e.target.value)}
              placeholder="GitHub username"
              className="field"
              autoCapitalize="none"
              autoCorrect="off"
            />
            {ghTier && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip chip-acc">{tierLabel(ghTier)}</span>
                {ghBio && <span className="text-xs text-[var(--color-mute)]">{ghBio}</span>}
              </div>
            )}
            <label className="flex items-center gap-2.5 text-sm text-[var(--color-dim)] min-h-11">
              <input
                type="checkbox"
                checked={ghVisible}
                onChange={async (e) => {
                  const v = e.target.checked
                  setGhVisible(v)
                  try {
                    await setGithubVisible(v)
                    toast(v ? 'Visible to others who opted in' : 'Hidden from builder list', 'info')
                  } catch (err: any) {
                    setGhVisible(!v)
                    toast(err.message || 'Could not update visibility', 'error')
                  }
                }}
                className="rounded border-[var(--color-line)]"
              />
              Show my DNA to other Cadens builders
            </label>
            <button
              type="button"
              disabled={ghBusy || !ghUser.trim()}
              onClick={async () => {
                setGhBusy(true)
                try {
                  await saveGithubUsername(ghUser.trim())
                  const dna = await fetchGithubDna(ghUser.trim())
                  await cacheGithubDna(dna)
                  setGhTier(dna.tier)
                  setGhBio(dna.bio_line)
                  toast('Builder DNA refreshed', 'success')
                } catch (e: any) {
                  toast(e.message || 'GitHub lookup failed', 'error')
                } finally {
                  setGhBusy(false)
                }
              }}
              className="w-full min-h-11 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] text-sm font-bold disabled:opacity-50"
            >
              {ghBusy ? 'Refreshing…' : 'Connect / refresh'}
            </button>
            {(ghUser || ghTier) && (
              <button
                type="button"
                disabled={ghBusy}
                onClick={async () => {
                  if (!confirm('Disconnect GitHub and clear cached DNA?')) return
                  setGhBusy(true)
                  try {
                    await disconnectGithubDna()
                    setGhUser('')
                    setGhTier(null)
                    setGhBio(null)
                    setGhVisible(false)
                    toast('GitHub disconnected', 'info')
                  } catch (e: any) {
                    toast(e.message || 'Disconnect failed', 'error')
                  } finally {
                    setGhBusy(false)
                  }
                }}
                className="w-full min-h-10 rounded-full border border-[var(--color-line)] text-sm font-bold text-[var(--color-danger)]"
              >
                Disconnect
              </button>
            )}
          </div>

          </>}

          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-mute)] px-1">
            Product
          </p>
          <div className="bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[16px] overflow-hidden">
            <button type="button" onClick={() => navigate('/notifications')} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-s2)] border-b border-[var(--color-line2)] text-left min-h-11">
              <Bell size={18} className="text-[var(--color-acc)]" />
              <div>
                <div className="text-sm font-bold">Notifications</div>
                <div className="text-xs text-[var(--color-mute)]">Alerts and updates</div>
              </div>
            </button>
            <button type="button" onClick={() => navigate('/tasks')} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-s2)] border-b border-[var(--color-line2)] text-left min-h-11">
              <CheckSquare size={18} className="text-[var(--color-acc)]" />
              <div>
                <div className="text-sm font-bold">Tasks</div>
                <div className="text-xs text-[var(--color-mute)]">Timed tasks sync to Plan</div>
              </div>
            </button>
            <button type="button" onClick={() => navigate('/calendar')} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-s2)] border-b border-[var(--color-line2)] text-left min-h-11">
              <Calendar size={18} className="text-[var(--color-acc)]" />
              <div>
                <div className="text-sm font-bold">Plan</div>
                <div className="text-xs text-[var(--color-mute)]">Calendar · agenda</div>
              </div>
            </button>
            <button type="button" onClick={() => navigate('/journal')} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-s2)] border-b border-[var(--color-line2)] text-left min-h-11">
              <BookOpen size={18} className="text-[var(--color-acc)]" />
              <div>
                <div className="text-sm font-bold">Journal</div>
                <div className="text-xs text-[var(--color-mute)]">Private · prompts · streaks</div>
              </div>
            </button>
            <button type="button" onClick={() => void handleExport()} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-s2)] text-left min-h-11">
              <Download size={18} className="text-[var(--color-dim)]" />
              <div>
                <div className="text-sm font-bold">Export my data</div>
                <div className="text-xs text-[var(--color-mute)]">JSON download of your Cadens content</div>
              </div>
            </button>
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-mute)] px-1">
            Legal
          </p>
          <div className="bg-[var(--color-s1)] border border-[var(--color-line2)] rounded-[16px] overflow-hidden">
            <button type="button" onClick={() => navigate('/legal/privacy')} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-s2)] border-b border-[var(--color-line2)] text-left min-h-11">
              <Shield size={18} className="text-[var(--color-dim)]" />
              <span className="text-sm font-semibold">Privacy Policy</span>
            </button>
            <button type="button" onClick={() => navigate('/legal/terms')} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-s2)] border-b border-[var(--color-line2)] text-left min-h-11">
              <FileText size={18} className="text-[var(--color-dim)]" />
              <span className="text-sm font-semibold">Terms of Use</span>
            </button>
            <button type="button" onClick={() => navigate('/legal/delete-account')} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-s2)] text-left min-h-11">
              <Trash2 size={18} className="text-[var(--color-danger)]" />
              <span className="text-sm font-semibold text-[var(--color-danger)]">Delete account</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {void signOut().catch(e=>toast(e.message || 'Could not log out', 'error'))}}
            className="w-full min-h-11 rounded-full border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] text-[var(--color-danger)] font-bold flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> Log out
          </button>
        </>
      )}
    </div>
  )
}
