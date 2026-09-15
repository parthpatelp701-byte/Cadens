/** Extract unique @handles from text (letters, numbers, underscore, 2–32 chars) */
export function extractMentions(text: string): string[] {
  const re = /@([a-zA-Z0-9_]{2,32})/g
  const found = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    found.add(m[1].toLowerCase())
  }
  return [...found]
}

/**
 * After a post/comment, try to notify mentioned users.
 * Resolves handles against daybook_accounts display names when possible;
 * always creates a local notification for the author as feedback.
 */
export async function notifyMentions(opts: {
  text: string
  targetId: string
  targetType: 'post' | 'comment'
  authorName?: string
}) {
  const [{ supabase }, { addLocalNotification }] = await Promise.all([
    import('./supabase'), import('./notifications'),
  ])
  const handles = extractMentions(opts.text)
  if (handles.length === 0) return

  addLocalNotification({
    type: 'mention',
    title: 'Mention',
    body: opts.text.slice(0, 120),
    targetId: opts.targetId,
    targetType: 'post',
  })

  // Best-effort: look up users by displayName in settings
  try {
    const { data: session } = await supabase.auth.getSession()
    const me = session.session?.user?.id
    if (!me) return

    // Query accounts that might match (limited — depends on schema)
    const { data: accounts } = await supabase
      .from('daybook_accounts')
      .select('user_id, settings')
      .limit(200)

    if (!accounts?.length) return

    const matchedIds = new Set<string>()
    for (const acc of accounts) {
      if (acc.user_id === me) continue
      const name = (
        (acc.settings as any)?.profile?.displayName ||
        (acc.settings as any)?.displayName ||
        ''
      )
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '')
      for (const h of handles) {
        if (name && (name === h || name.includes(h))) {
          matchedIds.add(acc.user_id)
        }
      }
    }

    // Server notify via existing helper if present (from notifications migration)
    for (const uid of matchedIds) {
      try {
        await supabase.rpc('daybook_notify_user', {
          p_user_id: uid,
          p_type: 'mention',
          p_title: `${opts.authorName || 'Someone'} mentioned you`,
          p_body: opts.text.slice(0, 120),
          p_target_id: opts.targetId,
          p_target_type: 'post',
        })
      } catch {
        // RPC may not exist — local notif already recorded
      }
    }
  } catch {
    // Schema may differ; silent fail
  }
}

/** Render text with @mentions highlighted (simple split) */
export function splitMentions(text: string): Array<{ type: 'text' | 'mention'; value: string }> {
  const parts: Array<{ type: 'text' | 'mention'; value: string }> = []
  const re = /@([a-zA-Z0-9_]{2,32})/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', value: text.slice(last, m.index) })
    }
    parts.push({ type: 'mention', value: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) {
    parts.push({ type: 'text', value: text.slice(last) })
  }
  return parts.length ? parts : [{ type: 'text', value: text }]
}
