import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'

const base = new URL(process.argv[2] || '')
assert.equal(base.protocol, 'https:', 'Pass an HTTPS Netlify deploy URL')
assert.match(base.hostname, /\.netlify\.app$/, 'Only Netlify deploy URLs are accepted')

for (const path of ['/welcome.html', '/signin', '/signup', '/calendar', '/app.html', '/cadens-auth.html']) {
  const response = await fetch(new URL(path, base), { redirect: 'manual' })
  assert.equal(response.status, 200, `${path} returned ${response.status}`)
}

const appResponse = await fetch(new URL('/app.html', base))
const csp = appResponse.headers.get('content-security-policy') || ''
const appHtml = await appResponse.text()
const tag = appHtml.match(/<script[^>]+src="([^"]*msal-browser[^"]*)"[^>]*>/)?.[0]
assert.ok(tag, 'MSAL script tag is missing')
const src = tag.match(/src="([^"]+)"/)?.[1]
const integrity = tag.match(/integrity="sha384-([^"]+)"/)?.[1]
assert.ok(src && integrity, 'MSAL source or SHA-384 integrity is missing')
assert.ok(csp.includes(new URL(src).origin), 'CSP does not allow the MSAL host')

const scriptResponse = await fetch(src)
assert.equal(scriptResponse.status, 200, `MSAL returned ${scriptResponse.status}`)
const scriptBytes = Buffer.from(await scriptResponse.arrayBuffer())
const actualIntegrity = createHash('sha384').update(scriptBytes).digest('base64')
assert.equal(actualIntegrity, integrity, 'MSAL SHA-384 integrity does not match')

const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    'C:/Users/ipart/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
)
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
try {
  const page = await browser.newPage()
  const failures = []
  page.on('pageerror', (error) => failures.push(error.message))
  page.on('requestfailed', (request) => failures.push(`${request.url()}: ${request.failure()?.errorText || 'failed'}`))
  await page.setContent(`${tag}</script>`, { waitUntil: 'load' })
  await page.waitForFunction(() => typeof window.msal?.PublicClientApplication === 'function')
  assert.deepEqual(failures, [])
} finally {
  await browser.close()
}

console.log('PASS: deployed routes, MSAL response, SRI, CSP and browser execution')
