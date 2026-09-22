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
if (problems.length) { console.error(problems.join('\n')); process.exit(1) }
console.log(`PASS SQL sanity scan (${files.length} migration files)`)
