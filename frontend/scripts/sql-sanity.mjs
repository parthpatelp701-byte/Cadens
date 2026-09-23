import fs from 'node:fs'
import path from 'node:path'
// The ZIP's top-level sql/ folder is reference material from several historical
// versions. Only versioned migrations under this frontend are release inputs.
const root = path.join(process.cwd(), 'supabase', 'migrations')
const files = fs.readdirSync(root).filter(f => f.endsWith('.sql'))
const problems = []
for (const f of files) {
  const text = fs.readFileSync(path.join(root,f),'utf8')
  for (const m of text.matchAll(/create\s+(?:unique\s+)?index[\s\S]*?;/gi)) {
    if (/\bwhere\b[\s\S]*?\bnow\s*\(/i.test(m[0])) problems.push(`${f}: partial index uses now(), which PostgreSQL rejects`)
  }
}
const rhythmSql = fs.readFileSync(path.join(process.cwd(), '..', 'sql', '18-connected-rhythm-collections.sql'), 'utf8')
for (const collection of ['habits','focus_sessions','mood_checkins','badges']) {
  if (!rhythmSql.includes(`'${collection}'`)) problems.push(`18-connected-rhythm-collections.sql: missing ${collection} daybook_sync allow-list entry`)
}
if (!/jsonb_typeof\(p\)\s*<>\s*'object'/i.test(rhythmSql)) problems.push('18-connected-rhythm-collections.sql: missing payload object validation')
if (!/c->>'deleted'\)\s*::boolean/i.test(rhythmSql)) problems.push('18-connected-rhythm-collections.sql: missing explicit delete handling')
const securitySql = fs.readFileSync(path.join(process.cwd(), '..', 'sql', '19-daybook-security-hardening.sql'), 'utf8')
for (const fn of ['daybook_load', 'daybook_sync', 'daybook_feed', 'daybook_groups', 'daybook_group_action']) {
  if (!new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}`, 'i').test(securitySql)) problems.push(`19-daybook-security-hardening.sql: missing anon/public revoke for ${fn}`)
  if (!new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}`, 'i').test(securitySql)) problems.push(`19-daybook-security-hardening.sql: missing authenticated grant for ${fn}`)
}
if (!/daybook_revisions_select/i.test(securitySql)) problems.push('19-daybook-security-hardening.sql: missing revision select policy')
if (problems.length) { console.error(problems.join('\n')); process.exit(1) }
console.log(`PASS SQL sanity scan (${files.length} migration files)`)
