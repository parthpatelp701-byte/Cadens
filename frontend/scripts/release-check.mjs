import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const required = [
  'package.json',
  'vite.config.ts',
  'src/App.tsx',
  'public/manifest.webmanifest',
  'public/sw.js',
  'public/cadens-icon-192.png',
  'public/cadens-icon-512.png',
]
const checks = []
for (const file of required) checks.push([file, fs.existsSync(path.join(root, file))])
const configs = [
  'supabase/functions/unfurl/config.toml',
  'supabase/functions/github-tier/config.toml',
  'supabase/functions/generate-embedding/config.toml',
  'supabase/functions/send-push/config.toml',
]
for (const file of configs) {
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  checks.push([`${file}: JWT enabled`, /verify_jwt\s*=\s*true/.test(text)])
}
const sql = fs.readFileSync(path.join(root, '../sql/00-daybook-baseline.sql'), 'utf8')
for (const fn of ['daybook_load','daybook_sync','daybook_feed','daybook_groups','daybook_group_action']) checks.push([`SQL RPC ${fn}`, sql.includes(`function public.${fn}`)])
checks.push(['SQL RPC daybook_social_action supplied by baseline', fs.readFileSync(path.join(root, '../sql/01-notifications.sql'),'utf8').includes('function cadens_private.social_action')])
const failed = checks.filter(([,ok]) => !ok)
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
if (failed.length) process.exit(1)
