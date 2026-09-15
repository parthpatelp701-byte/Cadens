import { supabase } from '@/lib/supabase'

export type GithubTier = 'spark' | 'builder' | 'shipper' | 'architect'

export interface GithubDna {
  username: string
  score: number
  tier: GithubTier
  bio_line: string
  stats?: Record<string, number>
}

export interface StoredBuilderDna {
  username?: string | null
  tier?: string | null
  score?: number | null
  bio_line?: string | null
  visible?: boolean
  refreshed_at?: string | null
}

export interface VisibleBuilder {
  user_id: string
  display_name: string
  github_username: string
  github_tier: string
  github_bio_line?: string | null
}

export async function fetchGithubDna(username: string): Promise<GithubDna> {
  const { data, error } = await supabase.functions.invoke('github-tier', {
    body: { username },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as GithubDna
}

export async function saveGithubUsername(username: string) {
  const { error } = await supabase.rpc('set_github_username', {
    p_username: username,
  })
  if (error) throw error
}

export async function cacheGithubDna(dna: GithubDna) {
  const { error } = await supabase.rpc('set_github_dna_cache', {
    p_tier: dna.tier,
    p_score: dna.score,
    p_bio_line: dna.bio_line,
  })
  if (error) throw error
}

export async function setGithubVisible(visible: boolean) {
  const { error } = await supabase.rpc('set_github_visible', {
    p_visible: visible,
  })
  if (error) throw error
}

export async function getMyBuilderDna(): Promise<StoredBuilderDna> {
  const { data, error } = await supabase.rpc('get_my_builder_dna')
  if (error) throw error
  return (data as StoredBuilderDna) || {}
}

export async function disconnectGithubDna() {
  const { error } = await supabase.rpc('disconnect_github_dna')
  if (error) throw error
}

export async function listVisibleBuilders(limit = 24): Promise<VisibleBuilder[]> {
  const { data, error } = await supabase.rpc('list_visible_builder_dna', {
    p_limit: limit,
  })
  if (error) throw error
  return (data as VisibleBuilder[]) || []
}

export function tierLabel(tier: string | null | undefined) {
  switch (tier) {
    case 'architect':
      return 'Architect'
    case 'shipper':
      return 'Shipper'
    case 'builder':
      return 'Builder'
    case 'spark':
      return 'Spark'
    default:
      return '—'
  }
}
