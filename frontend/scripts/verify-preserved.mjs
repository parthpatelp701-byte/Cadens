import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const frontend = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(readFileSync(resolve(frontend, 'preserved-artifacts.json'), 'utf8'))
for (const [name, hash] of Object.entries(manifest.sha256)) {
  const actual = createHash('sha256').update(readFileSync(resolve(frontend, 'public', name))).digest('hex')
  if (actual !== hash) throw new Error(`Preserved artifact changed: ${name}. Review and update its provenance/hash before release.`)
}
const config = readFileSync(resolve(frontend, '../netlify.toml'), 'utf8')
const headers = readFileSync(resolve(frontend, 'public/_headers'), 'utf8')
for (const name of ['app.html', 'welcome.html', 'cadens-auth.html']) {
  const html = readFileSync(resolve(frontend, 'public', name), 'utf8')
  for (const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    if (!script[1].trim()) continue
    const hash = `'sha256-${createHash('sha256').update(script[1]).digest('base64')}'`
    if (!headers.includes(hash) || !config.includes(hash)) throw new Error(`Missing CSP hash for ${name}`)
  }
}
console.log('Preserved app, auth, landing and CSP integrity verified')
