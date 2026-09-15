import { supabase } from '@/lib/supabase'

export type ProductivityTier = 'spark' | 'builder' | 'shipper' | 'architect'

export interface TierResult {
  username: string
  score: number
  tier: ProductivityTier
  bio_line: string
  stats?: {
    public_repos: number
    followers: number
    following: number
    years: number
    recent_events: number
    push_events: number
    avatar_url?: string
    html_url?: string
    name?: string
  }
}

export interface NearbyPeer {
  user_id: string
  display_name: string
  github_username: string | null
  tier: ProductivityTier
  github_score: number
  bio_line: string | null
  distance_m: number
  tier_match: 'same' | 'adjacent' | 'other'
}

export interface ProductivityProfile {
  user_id: string
  github_username: string | null
  github_score: number
  tier: ProductivityTier
  bio_line: string | null
  session_active: boolean
  session_radius_m: number
  session_expires_at: string | null
}

export const TIER_META: Record<
  ProductivityTier,
  { label: string; color: string; blurb: string }
> = {
  spark: {
    label: 'Spark',
    color: 'text-amber-400',
    blurb: 'Getting started — learning in public',
  },
  builder: {
    label: 'Builder',
    color: 'text-[var(--color-acc)]',
    blurb: 'Shipping projects and growing a footprint',
  },
  shipper: {
    label: 'Shipper',
    color: 'text-violet-400',
    blurb: 'Consistent output and visible impact',
  },
  architect: {
    label: 'Architect',
    color: 'text-emerald-400',
    blurb: 'Deep track record and community gravity',
  },
}

/** Fetch GitHub stats + compute tier via Edge Function */
export async function fetchGithubTier(username: string): Promise<TierResult> {
  const { data, error } = await supabase.functions.invoke('github-tier', {
    body: { username },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as TierResult
}

export async function saveProductivityProfile(tier: TierResult) {
  const { data, error } = await supabase.rpc('upsert_productivity_profile', {
    p_github_username: tier.username,
    p_github_score: tier.score,
    p_tier: tier.tier,
    p_bio_line: tier.bio_line,
  })
  if (error) throw error
  return data as ProductivityProfile
}

export async function getMyProductivityProfile(): Promise<ProductivityProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('productivity_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  return data as ProductivityProfile | null
}

/** Browser geolocation → coarse session */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 60_000,
    })
  })
}

export async function startDiscoverySession(opts?: {
  radiusM?: number
  durationMinutes?: number
}) {
  const pos = await getCurrentPosition()
  const { data, error } = await supabase.rpc('start_discovery_session', {
    p_lat: pos.coords.latitude,
    p_lng: pos.coords.longitude,
    p_radius_m: opts?.radiusM ?? 2000,
    p_duration_minutes: opts?.durationMinutes ?? 60,
  })
  if (error) throw error
  return data as ProductivityProfile
}

export async function stopDiscoverySession() {
  const { error } = await supabase.rpc('stop_discovery_session')
  if (error) throw error
}

export async function findNearbyPeers(limit = 30): Promise<NearbyPeer[]> {
  const { data, error } = await supabase.rpc('find_nearby_peers', {
    limit_count: limit,
  })
  if (error) throw error
  return (data as NearbyPeer[]) || []
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
}
