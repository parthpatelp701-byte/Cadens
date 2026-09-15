import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { BrandWordmark } from '@/components/brand/BrandMark'
import { AmbientBackground } from '@/components/layout/AmbientBackground'
import { Link, useLocation, useNavigate } from 'react-router-dom'

type Mode = 'login' | 'signup' | 'reset' | 'password'

export function AuthPage() {
  const { signIn, signUp, resetPassword, signInGoogle, updatePassword, recovery, loading: sessionPending, error: authError } = useAuth()
  const route = useLocation()
  const navigate = useNavigate()
  const selectedMode: Mode = route.pathname === '/reset' ? 'reset' : route.hash === '#signup' || route.pathname === '/signup' ? 'signup' : 'login'
  const mode:Mode=recovery?'password':selectedMode
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'info' | 'error'>('info')
  const [loading, setLoading] = useState(false)
  useEffect(() => { if (authError) { setMessage(authError); setMessageTone('error') } }, [authError])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading || sessionPending) return
    setLoading(true)
    setMessage('')
    setMessageTone('info')
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await signUp(email, password)
        if (error) throw error
        if (!data.session) setMessage('Check your inbox — one tap and you’re in.')
      } else if(mode==='password'){
        const {error}=await updatePassword(password)
        if(error)throw error
      } else {
        const { error } = await resetPassword(email)
        if (error) throw error
        setMessage('If that account exists, a reset link is on the way.')
        navigate('/signin', { viewTransition: true })
      }
    } catch (err: any) {
      setMessageTone('error')
      setMessage(err.message || 'That didn’t work. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const titles = {
    login: 'back to your rhythm',
    signup: 'start your cadence',
    reset: 'find your way back',
    password: 'pick a fresh password',
  }
  const actions = {
    login: 'keep going',
    signup: 'get started free',
    reset: 'send reset link',
    password: 'save new password',
  }

  return (
    <div className="auth-stage">
      <AmbientBackground />
      <header className="auth-nav">
        <a href="/welcome.html" className="cadens-brand-transition" aria-label="Cadens home"><BrandWordmark /></a>
        <a href="/welcome.html" className="auth-back">← home</a>
      </header>
      <main id="main-content" className="auth-layout">
        <div className="auth-story">
          <span className="rhythm-sticker">your life. your tempo.</span>
          <h1>less chaos.<br /> <em>more cadence.</em></h1>
          <p>A little space for everything you want to do.</p>
          <div className="auth-beat" aria-hidden><svg viewBox="0 0 420 100" fill="none"><path d="M0 50h70l16-24 20 46 17-22h70l20-43 23 85 22-42h60l16-20 18 40 17-20h51" /></svg></div>
        </div>
        <div className="auth-card surface-elevated" aria-busy={loading || sessionPending}>
        <div className="auth-card-heading"><h2>{titles[mode]}</h2></div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode!=='password'&&<div>
            <label htmlFor="auth-email" className="block text-[0.72rem] font-bold text-[var(--color-dim)] mb-1.5">Email</label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field text-base"
            />
          </div>}

          {mode !== 'reset' && (
            <div>
              <label htmlFor="auth-password" className="block text-[0.72rem] font-bold text-[var(--color-dim)] mb-1.5">Password</label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={mode === 'login' ? undefined : 8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field text-base"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || sessionPending}
            className="w-full min-h-12 mt-1.5 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] border-2 border-[var(--color-ink)] font-bold text-[0.95rem] shadow-[4px_4px_0_var(--color-ink)] disabled:opacity-60 active:translate-x-1 active:translate-y-1 active:shadow-none transition"
          >
            {loading ? 'one sec…' : actions[mode]}
          </button>
        </form>
        {!recovery&&mode!=='reset'&&<button type="button" className="w-full min-h-12 mt-3 rounded-full border border-[var(--color-line)]" disabled={loading || sessionPending} onClick={async()=>{
          setLoading(true)
          setMessage('');setMessageTone('info')
          try{const {error}=await signInGoogle();if(error)throw error}catch(e){setMessageTone('error');setMessage(e instanceof Error?e.message:'Google sign-in failed');setLoading(false)}
        }}>continue with Google</button>}

        {message && (
          <p className={`mt-3 text-center text-[0.8125rem] whitespace-pre-wrap ${messageTone === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-dim)]'}`} role="alert">
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-[11px] text-[var(--color-mute)] leading-relaxed px-2">
          By continuing you agree to our{' '}
          <Link to="/legal/terms" className="text-[var(--color-acc)]">Terms</Link>
          {' '}and{' '}
          <Link to="/legal/privacy" className="text-[var(--color-acc)]">Privacy Policy</Link>.
        </p>
        {!recovery&&<div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 pt-5 border-t border-[var(--color-line2)]">
          {mode !== 'login' && (
            <Link to="/signin" viewTransition className="auth-mode-link text-[0.85rem] font-semibold text-[var(--color-acc)]">
              Log in
            </Link>
          )}
          {mode !== 'signup' && (
            <Link to="/signup" viewTransition className="auth-mode-link text-[0.85rem] font-semibold text-[var(--color-acc)]">
              Sign up
            </Link>
          )}
          {mode !== 'reset' && (
            <Link to="/reset" viewTransition className="auth-mode-link text-[0.85rem] font-semibold text-[var(--color-acc)]">
              Forgot password
            </Link>
          )}
        </div>}
        </div>
      </main>
    </div>
  )
}
