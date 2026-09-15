// Cadens v2 — Generate embedding (+ optional short summary) for a Save
// Also supports mode: "query" to embed a search string (returns { embedding }).
//
// Deploy: supabase functions deploy generate-embedding
// Secrets: OPENAI_API_KEY
//
// Body (save):
//   { save_id: string, generate_summary?: boolean }
// Body (query embed):
//   { mode: "query", text: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const EMBEDDING_MODEL = 'text-embedding-3-small' // 1536 dimensions
const SUMMARY_MODEL = 'gpt-4o-mini'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!OPENAI_API_KEY) {
      return json({ error: 'OPENAI_API_KEY not configured' }, 500)
    }

    const body = await req.json()

    // --- Query embedding mode (for search) ---
    if (body.mode === 'query') {
      const text = (body.text || '').trim()
      if (!text) return json({ error: 'text required' }, 400)
      const embedding = await createEmbedding(text.slice(0, 4000))
      return json({ embedding, dimensions: embedding.length })
    }

    // --- Save embedding mode ---
    const { save_id, generate_summary = true } = body
    if (!save_id) {
      return json({ error: 'save_id required (or mode: "query")' }, 400)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: save, error: loadErr } = await supabase
      .from('saves')
      .select('id, body, link_url, link_title, link_description, ai_summary, user_id')
      .eq('id', save_id)
      .single()

    if (loadErr || !save) {
      return json({ error: loadErr?.message || 'Save not found' }, 404)
    }

    const parts = [
      save.link_title,
      save.link_description,
      save.body,
      save.ai_summary,
      save.link_url,
    ].filter(Boolean) as string[]

    const textForEmbed = parts.join('\n').slice(0, 8000)
    if (!textForEmbed.trim()) {
      return json({ error: 'Nothing to embed', skipped: true }, 200)
    }

    let ai_summary = save.ai_summary as string | null
    if (generate_summary && !ai_summary && textForEmbed.length > 40) {
      try {
        ai_summary = await generateSummary(textForEmbed)
      } catch (e) {
        console.warn('Summary generation failed', e)
      }
    }

    const embedding = await createEmbedding(
      ai_summary ? `${ai_summary}\n\n${textForEmbed}` : textForEmbed
    )

    const { error: updateErr } = await supabase
      .from('saves')
      .update({
        embedding,
        ...(ai_summary && !save.ai_summary ? { ai_summary } : {}),
      })
      .eq('id', save_id)

    if (updateErr) {
      return json({ error: updateErr.message }, 500)
    }

    return json({
      ok: true,
      save_id,
      dimensions: embedding.length,
      summary: ai_summary ?? null,
    })
  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message || 'Unknown error' }, 500)
  }
})

async function createEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI embeddings failed: ${res.status} ${body}`)
  }

  const json = await res.json()
  return json.data[0].embedding as number[]
}

async function generateSummary(text: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      temperature: 0.2,
      max_tokens: 80,
      messages: [
        {
          role: 'system',
          content:
            'Summarize the following saved item in one short, searchable phrase (max 15 words). No quotes. Focus on the core idea or content.',
        },
        { role: 'user', content: text.slice(0, 2000) },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI summary failed: ${res.status} ${body}`)
  }

  const json = await res.json()
  return (json.choices?.[0]?.message?.content || '').trim()
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
