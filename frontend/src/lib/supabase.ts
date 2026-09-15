import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in the environment (Netlify / .env).'
  )
}

let isAnonJwt = false
if (supabaseAnonKey.startsWith('eyJ')) {
  try { isAnonJwt = JSON.parse(atob(supabaseAnonKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role === 'anon' } catch { /* invalid key */ }
}
if (!supabaseAnonKey.startsWith('sb_publishable_') && !isAnonJwt) {
  throw new Error('A Supabase publishable key is required')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
