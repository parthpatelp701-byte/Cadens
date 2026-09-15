import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listConversations,
  listMessages,
  sendMessage,
  type Conversation,
  type Message,
} from '@/lib/messages'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, Send, MessageCircle, Users } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'

function displayConversationTitle(c: Conversation) {
  if (c.is_group) {
    const raw = c.title || 'Group chat'
    // Strip internal "g:<id>:" prefix from group chat titles
    const cleaned = raw.replace(/^g:[^:]+:/, '').trim()
    return cleaned || 'Group chat'
  }
  return c.members?.[0]?.name || 'Chat'
}

export function MessagesPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    try {
      const data = await listConversations()
      setConversations(data)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Could not load messages. Run the Messages SQL migration first.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMessages = useCallback(async (id: string) => {
    try {
      const data = await listMessages(id)
      setMessages(data)
      loadConversations()
    } catch (err: any) {
      setError(err.message || 'Failed to load messages')
    }
  }, [loadConversations])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Open conversation passed from Groups "Message" button
  useEffect(() => {
    const openId = (location.state as any)?.openConversationId as string | undefined
    if (openId) {
      setActiveId(openId)
      navigate('/messages', { replace: true, state: {} })
    }
  }, [location.state, navigate])

  useEffect(() => {
    if (!activeId) return
    loadMessages(activeId)

    const channel = supabase
      .channel(`messages:${activeId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'daybook_messages',
          filter: `conversation_id=eq.${activeId}`,
        },
        () => loadMessages(activeId)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeId, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!activeId || !text.trim() || sending) return
    setSending(true)
    try {
      await sendMessage(activeId, text.trim())
      setText('')
      await loadMessages(activeId)
    } catch (err: any) {
      const msg = err.message || 'Failed to send'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setSending(false)
    }
  }

  const active = conversations.find((c) => c.id === activeId)
  const title = active ? displayConversationTitle(active) : 'Chat'

  if (!activeId) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-xl font-bold tracking-tight">Messages</h1>
          <p className="text-sm text-[var(--color-dim)]">Private & group conversations</p>
        </header>

        {error && (
          <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {loading ? (
          <ListSkeleton rows={5} />
        ) : conversations.length === 0 ? (
          <div className="py-20 text-center text-[var(--color-dim)]">
            <MessageCircle size={36} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">No conversations yet</p>
            <p className="text-sm mt-1 max-w-xs mx-auto">
              Message someone from a group member list, their profile, or start a group chat from Groups.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((c) => {
              const name = displayConversationTitle(c)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-[14px] hover:bg-[var(--color-s2)] text-left transition"
                >
                  <div className="w-12 h-12 rounded-full bg-[var(--color-s3)] flex items-center justify-center font-bold shrink-0 relative">
                    {(name[0] || '?').toUpperCase()}
                    {c.is_group && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] flex items-center justify-center">
                        <Users size={10} />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-sm truncate">
                        {name}
                        {c.is_group && (
                          <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-mute)]">
                            Group
                          </span>
                        )}
                      </p>
                      {c.last_message && (
                        <span className="text-[11px] text-[var(--color-mute)] shrink-0">
                          {formatDistanceToNow(new Date(c.last_message.created_at), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--color-dim)] truncate">
                      {c.last_message?.body || 'No messages yet'}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] text-[11px] font-bold flex items-center justify-center">
                      {c.unread}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100dvh-4rem)] -mx-4 md:-mx-8">
      <div className="flex items-center gap-3 px-4 md:px-8 py-3 border-b border-[var(--color-line2)]">
        <button
          type="button"
          onClick={() => setActiveId(null)}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--color-s2)]"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="w-9 h-9 rounded-full bg-[var(--color-s3)] flex items-center justify-center font-bold text-sm relative">
          {(title[0] || '?').toUpperCase()}
          {active?.is_group && (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] flex items-center justify-center">
              <Users size={9} />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold truncate">{title}</p>
          {active?.is_group && (
            <p className="text-[11px] text-[var(--color-dim)]">Group chat</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-2">
        {messages.map((m) => {
          const mine = m.sender_id === user?.id
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  mine
                    ? 'bg-[var(--color-acc)] text-[var(--color-ink)] rounded-br-md'
                    : 'bg-[var(--color-s2)] text-[var(--color-txt)] rounded-bl-md'
                }`}
              >
                {!mine && (
                  <p className="text-[11px] font-bold opacity-70 mb-0.5">{m.sender_name}</p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-1 ${mine ? 'text-[var(--color-ink)]' : 'text-[var(--color-mute)]'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 md:px-8 py-3 border-t border-[var(--color-line2)] safe-bottom">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Message…"
            className="flex-1 bg-[var(--color-s2)] border border-[var(--color-line)] rounded-full px-4 py-2.5 text-sm outline-none focus:border-[var(--color-acc)]"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="w-10 h-10 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] flex items-center justify-center disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
