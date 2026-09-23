import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import './styles/index.css'
import { registerServiceWorker } from './lib/registerSw'
import { bindOnlineStatus } from './lib/onlineStatus'
import { AuthProvider } from './hooks/useAuth'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'

registerServiceWorker()
bindOnlineStatus()

// A data router enables Link's existing viewTransition option without changing
// any of App's routes, component APIs, or client-only rendering model.
const router = createBrowserRouter([{ path: '*', element:
  <QueryClientProvider client={queryClient}><AuthProvider><App /></AuthProvider></QueryClientProvider>,
}])

function mountCadens() {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    console.error('[cadens] Missing #root mount element')
    return
  }

  // Commit the first route before the module releases the document's first paint.
  // Auth session requests remain asynchronous; the form stays in place while loading.
  flushSync(() => createRoot(rootElement).render(
    <StrictMode><RouterProvider router={router} /></StrictMode>
  ))
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountCadens, { once: true })
} else {
  mountCadens()
}
