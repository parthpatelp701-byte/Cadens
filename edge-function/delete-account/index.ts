// Optional Phase 6 — fully delete auth user (service role).
// Deploy with SUPABASE_SERVICE_ROLE_KEY. Client should call after wipe_my_cadens_data.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const admin = createClient(supabaseUrl, service)
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
  if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 500 })
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
