// Cadens — GitHub productivity tier
// Body: { username: string }
// Returns: { username, score, tier, bio_line, stats }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Tier = 'spark' | 'builder' | 'shipper' | 'architect'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { username } = await req.json()
    if (!username || typeof username !== 'string') {
      return json({ error: 'username required' }, 400)
    }
    const clean = username.trim().replace(/^@/, '').toLowerCase()
    if (!/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i.test(clean)) {
      return json({ error: 'Invalid GitHub username' }, 400)
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Cadens-Productivity-Tier',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    const token = Deno.env.get('GITHUB_TOKEN')
    if (token) headers.Authorization = `Bearer ${token}`

    const userRes = await fetch(`https://api.github.com/users/${clean}`, { headers })
    if (userRes.status === 404) return json({ error: 'GitHub user not found' }, 404)
    if (!userRes.ok) {
      const t = await userRes.text()
      return json({ error: `GitHub API error: ${userRes.status}`, detail: t.slice(0, 200) }, 502)
    }
    const user = await userRes.json()

    // Public events as a rough activity signal (last 90 events max from API)
    let recentEvents = 0
    let pushEvents = 0
    try {
      const evRes = await fetch(`https://api.github.com/users/${clean}/events/public?per_page=30`, {
        headers,
      })
      if (evRes.ok) {
        const events = await evRes.json()
        if (Array.isArray(events)) {
          recentEvents = events.length
          pushEvents = events.filter((e: { type?: string }) => e.type === 'PushEvent').length
        }
      }
    } catch {
      /* optional */
    }

    const publicRepos = Number(user.public_repos) || 0
    const followers = Number(user.followers) || 0
    const following = Number(user.following) || 0
    const created = user.created_at ? new Date(user.created_at) : new Date()
    const years = Math.max(0, (Date.now() - created.getTime()) / (365.25 * 24 * 3600 * 1000))

    // Weighted score (transparent, gameable but good enough for peer banding)
    const score = Math.round(
      publicRepos * 3 +
        Math.min(followers, 500) * 0.5 +
        Math.min(following, 200) * 0.1 +
        years * 8 +
        recentEvents * 2 +
        pushEvents * 4
    )

    const tier = scoreToTier(score)
    const bio_line =
      user.bio?.slice(0, 120) ||
      `${publicRepos} public repos · ${followers} followers · on GitHub ${years.toFixed(1)}y`

    return json({
      username: clean,
      score,
      tier,
      bio_line,
      stats: {
        public_repos: publicRepos,
        followers,
        following,
        years: Math.round(years * 10) / 10,
        recent_events: recentEvents,
        push_events: pushEvents,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        name: user.name,
      },
    })
  } catch (err) {
    return json({ error: (err as Error).message || 'Failed' }, 500)
  }
})

function scoreToTier(score: number): Tier {
  if (score >= 200) return 'architect'
  if (score >= 90) return 'shipper'
  if (score >= 35) return 'builder'
  return 'spark'
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
