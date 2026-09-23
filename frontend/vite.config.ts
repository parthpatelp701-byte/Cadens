import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), {
    name: 'cadens-preserved-release-check',
    apply: 'build',
    buildStart() {
      const env = { ...loadEnv(mode, __dirname, ''), ...process.env }
      const manifest = JSON.parse(readFileSync(path.resolve(__dirname, 'preserved-artifacts.json'), 'utf8')) as { supabaseProject?: string }
      const expectedProject = manifest.supabaseProject
      const expectedUrl = expectedProject ? `https://${expectedProject}.supabase.co` : ''
      if (!expectedProject || env.VITE_SUPABASE_URL !== expectedUrl) {
        throw new Error(`Preserved app targets Supabase project ${expectedProject || 'unknown'}. Set VITE_SUPABASE_URL to ${expectedUrl || 'the preserved manifest project'} or rebuild and re-verify preserved assets before using a different backend.`)
      }
      execFileSync(process.execPath, [path.resolve(__dirname, 'scripts/verify-preserved.mjs')], { stdio: 'inherit' })
    },
    writeBundle() {
      // Warm the actual fingerprinted entry while the visitor reads the landing.
      // No app scripts execute there and no bundled styles alter its design.
      const output = path.resolve(__dirname, 'dist')
      const index = readFileSync(path.join(output, 'index.html'), 'utf8')
      // Vite regenerates this tag and drops unknown input attributes.
      writeFileSync(path.join(output, 'index.html'), index.replace('<script type="module"', '<script blocking="render" type="module"'))
      const script = index.match(/<script[^>]+src="([^"]+)"/)?.[1]
      const css = [...index.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(match => match[1]).find(href => href.startsWith('/assets/'))
      if (!script || !css) throw new Error('Missing auth handoff build assets')
      const landingPath = path.join(output, 'welcome.html')
      const landing = readFileSync(landingPath, 'utf8')
      const hints = `<link rel="modulepreload" fetchpriority="low" href="${script}">\n<link rel="prefetch" as="style" href="${css}">\n`
      writeFileSync(landingPath, landing.replace('</head>', hints + '</head>'))
    },
  }],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
}))
