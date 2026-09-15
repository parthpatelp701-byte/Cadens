import { supabase } from './supabase'

export interface LegacyRecord { collection: string; id: string; payload: Record<string, any> }
export interface LegacyBook { revision: number; settings: Record<string, any>; records: LegacyRecord[] }
export interface LegacyChange { collection: string; id: string; payload?: Record<string, any>; deleted?: boolean }

async function identity() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session?.user.id) throw new Error('Please sign in again.')
  return data.session.user.id
}

export async function loadLegacyBook(): Promise<LegacyBook> {
  const userId = await identity()
  const { data, error } = await supabase.rpc('daybook_load')
  if (error) throw error
  if (userId !== await identity()) throw new Error('Account changed. Please reload.')
  if (!data || !Number.isSafeInteger(data.revision) || !Array.isArray(data.records)) throw new Error('Invalid account response')
  return data as LegacyBook
}

/** Preserve the existing account revision contract. A conflict is never blindly retried. */
export async function mutateLegacyBook(build: (book: LegacyBook) => {
  changes: LegacyChange[]; settings?: Record<string, any>
}): Promise<void> {
  const userId = await identity()
  const book = await loadLegacyBook()
  const mutation = build(book)
  if (userId !== await identity()) throw new Error('Account changed. Please reload.')
  const { error } = await supabase.rpc('daybook_sync', {
    expected: book.revision, changes: mutation.changes, preferences: mutation.settings ?? book.settings,
  })
  if (error) throw error
}
