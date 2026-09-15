import { supabase } from '@/lib/supabase'

export interface MatchedContact {
  user_id: string
  display_name: string
  matched_via: 'email' | 'phone' | 'both'
  last_active_at: string | null
  is_active: boolean
  /** Local label from device contact if available */
  local_name?: string
}

export interface ActivePeer {
  user_id: string
  display_name: string
  group_names: string | null
  last_active_at: string | null
}

/** Normalize phone to digits-only E.164-ish form before hashing */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // Keep last 10–15 digits to reduce country-code variance noise
  if (digits.length >= 10) return digits.slice(-15)
  return digits
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/** SHA-256 hex digest (Web Crypto) */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashEmail(email: string): Promise<string> {
  return sha256Hex(normalizeEmail(email))
}

export async function hashPhone(phone: string): Promise<string> {
  return sha256Hex(normalizePhone(phone))
}

/** Opt in so friends can find you by hashed email/phone */
export async function upsertMyDiscovery(input: {
  email?: string
  phone?: string
  displayName?: string
  discoverable?: boolean
}) {
  const email_hash = input.email ? await hashEmail(input.email) : null
  const phone_hash = input.phone ? await hashPhone(input.phone) : null

  const { data, error } = await supabase.rpc('upsert_my_discovery', {
    p_email_hash: email_hash,
    p_phone_hash: phone_hash,
    p_display_name: input.displayName || null,
    p_discoverable: input.discoverable ?? true,
  })
  if (error) throw error
  return data
}

export async function touchMyActivity() {
  try {
    await supabase.rpc('touch_my_activity')
  } catch {
    /* optional */
  }
}

/**
 * Match local contact identifiers against registered users.
 * Only hashes are sent to the server — never raw contact lists.
 */
export async function matchContacts(
  contacts: { name?: string; email?: string; phone?: string }[]
): Promise<MatchedContact[]> {
  const hashToLocalName = new Map<string, string>()
  const hashes: string[] = []

  for (const c of contacts) {
    if (c.email) {
      const h = await hashEmail(c.email)
      hashes.push(h)
      if (c.name) hashToLocalName.set(h, c.name)
    }
    if (c.phone) {
      const h = await hashPhone(c.phone)
      hashes.push(h)
      if (c.name) hashToLocalName.set(h, c.name)
    }
  }

  const unique = [...new Set(hashes)].filter(Boolean)
  if (unique.length === 0) return []

  const { data, error } = await supabase.rpc('match_contact_hashes', {
    p_hashes: unique,
  })
  if (error) throw error

  return ((data as MatchedContact[]) || []).map((row) => ({
    ...row,
    local_name:
      hashToLocalName.get(
        // best-effort: we don't know which hash matched; use display if no local
        ''
      ) || undefined,
  }))
}

export async function listActiveGroupPeers(limit = 20): Promise<ActivePeer[]> {
  const { data, error } = await supabase.rpc('list_active_group_peers', {
    limit_count: limit,
  })
  if (error) {
    console.warn('list_active_group_peers', error.message)
    return []
  }
  return (data as ActivePeer[]) || []
}

/** Contact Picker API (Chrome Android / some desktop) */
export async function pickDeviceContacts(
  max = 50
): Promise<{ name?: string; email?: string; phone?: string }[]> {
  // @ts-expect-error Contact Picker is not in all TS libs
  if (typeof navigator === 'undefined' || typeof navigator.contacts?.select !== 'function') {
    throw new Error('Contact Picker is not supported in this browser')
  }
  // @ts-expect-error Contact Picker API
  const results = await navigator.contacts.select(['name', 'email', 'tel'], {
    multiple: true,
  })
  const out: { name?: string; email?: string; phone?: string }[] = []
  for (const c of results.slice(0, max)) {
    const name = c.name?.[0]
    const email = c.email?.[0]
    const phone = c.tel?.[0]
    if (email || phone) out.push({ name, email, phone })
  }
  return out
}

export function contactPickerSupported(): boolean {
  // @ts-expect-error
  return typeof navigator !== 'undefined' && typeof navigator.contacts?.select === 'function'
}

/** Parse pasted text: emails and phone-like tokens */
export function parsePastedContacts(text: string): { email?: string; phone?: string }[] {
  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  const phones = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || []
  const out: { email?: string; phone?: string }[] = []
  for (const e of emails) out.push({ email: e })
  for (const p of phones) {
    if (normalizePhone(p).length >= 10) out.push({ phone: p })
  }
  return out
}
