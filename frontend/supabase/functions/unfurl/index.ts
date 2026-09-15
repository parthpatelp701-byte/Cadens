// Cadens — Link unfurl (Open Graph / basic meta)
// Deploy: supabase functions deploy unfurl
// Body: { url: string }
// Returns: { title?, description?, image?, siteName?, favicon? }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return json({ error: 'url required' }, 400)
    }

    let parsed: URL
    try {
      parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return json({ error: 'Only http/https URLs supported' }, 400)
      }
    } catch {
      return json({ error: 'Invalid URL' }, 400)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CadensBot/1.0 (+https://cadens.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)

    if (!res.ok) {
      return json({
        title: hostnameTitle(parsed),
        siteName: parsed.hostname.replace(/^www\./, ''),
      })
    }

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('xhtml')) {
      return json({
        title: hostnameTitle(parsed),
        siteName: parsed.hostname.replace(/^www\./, ''),
      })
    }

    // Read limited HTML
    const reader = res.body?.getReader()
    let html = ''
    if (reader) {
      const decoder = new TextDecoder()
      while (html.length < 120_000) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
        if (html.includes('</head>') || html.length > 100_000) break
      }
      try {
        reader.cancel()
      } catch {
        /* ignore */
      }
    }

    const meta = parseMeta(html, parsed)
    return json(meta)
  } catch (err) {
    const message = (err as Error).name === 'AbortError' ? 'Timeout' : (err as Error).message
    return json({ error: message || 'Unfurl failed' }, 500)
  }
})

function hostnameTitle(u: URL) {
  return u.hostname.replace(/^www\./, '')
}

function parseMeta(html: string, base: URL) {
  const get = (prop: string) => {
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      'i'
    )
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
      'i'
    )
    const m = html.match(re1) || html.match(re2)
    return m?.[1]?.trim()
  }

  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
  const title = decode(get('og:title') || get('twitter:title') || titleTag) || hostnameTitle(base)
  const description = decode(
    get('og:description') || get('twitter:description') || get('description')
  )
  let image = get('og:image') || get('twitter:image')
  if (image) {
    try {
      image = new URL(image, base).toString()
    } catch {
      image = undefined
    }
  }
  const siteName = decode(get('og:site_name')) || base.hostname.replace(/^www\./, '')
  let favicon: string | undefined
  const favMatch =
    html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i)
  if (favMatch?.[1]) {
    try {
      favicon = new URL(favMatch[1], base).toString()
    } catch {
      favicon = undefined
    }
  }

  return { title, description, image, siteName, favicon }
}

function decode(s?: string) {
  if (!s) return s
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
