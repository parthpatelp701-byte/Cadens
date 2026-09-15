import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { deleteAccountAndSignOut } from '@/lib/account'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'

type Doc = 'privacy' | 'terms' | 'delete-account'

const TITLES: Record<Doc, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Use',
  'delete-account': 'Delete your account',
}

const SUPPORT_EMAIL = 'support@cadens.app'

export function LegalPage() {
  const { doc } = useParams<{ doc: string }>()
  const key = (doc === 'privacy' || doc === 'terms' || doc === 'delete-account'
    ? doc
    : 'privacy') as Doc

  return (
    <div className="space-y-4 max-w-2xl page-enter">
      <Link
        to="/you"
        className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-acc)] min-h-11"
      >
        <ChevronLeft size={18} /> Back
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{TITLES[key]}</h1>
      <p className="text-xs text-[var(--color-mute)]">Last updated: September 10, 2026</p>

      <div className="prose-legal">
        {key === 'privacy' && <PrivacyBody />}
        {key === 'terms' && <TermsBody />}
        {key === 'delete-account' && <DeleteBody />}
      </div>
    </div>
  )
}

function PrivacyBody() {
  return (
    <>
      <p>
        Cadens (“we”) provides a private productivity app for saves, progress updates, groups,
        tasks, calendar (Plan), and journal. This policy describes what we collect and why.
      </p>
      <h2>Data we process</h2>
      <ul>
        <li>
          <strong>Account:</strong> email and authentication identifiers from our auth provider
          (Supabase).
        </li>
        <li>
          <strong>Saves:</strong> links, notes, titles, collections, optional previews you add.
        </li>
        <li>
          <strong>Progress:</strong> short updates you post and the privacy level you choose
          (private / group / circle).
        </li>
        <li>
          <strong>People / groups:</strong> membership, idea boards, and messages you send in
          groups you join.
        </li>
        <li>
          <strong>Tasks &amp; Plan:</strong> task titles, notes, due times, and calendar events
          (including events created when a task has a due time).
        </li>
        <li>
          <strong>Journal:</strong> private journal entries, optional images, and streak-related
          metadata.
        </li>
        <li>
          <strong>Notifications &amp; push:</strong> in-app notification records; if you enable
          web push, a browser push subscription endpoint.
        </li>
        <li>
          <strong>Device / technical:</strong> basic logs needed to operate the service (e.g.
          security and error diagnostics).
        </li>
      </ul>
      <h2>What we do not do</h2>
      <ul>
        <li>We do not sell your personal content.</li>
        <li>We do not run a public social graph; sharing is limited to groups and privacy settings you choose.</li>
        <li>Location is not collected for core features. Experimental nearby features are not part of the shipped product.</li>
      </ul>
      <h2>Storage &amp; processors</h2>
      <p>
        Application data is stored in Supabase (database, auth, storage). The web app may be
        hosted on Netlify or similar. Processors act under their terms and our configuration
        (including row-level security so users only access their own rows where policies apply).
      </p>
      <h2>Retention &amp; deletion</h2>
      <p>
        You can delete individual items in the app. To remove your Cadens content and sign out,
        use <Link to="/legal/delete-account">Delete your account</Link>. Auth-provider account
        removal may complete after content wipe; contact {SUPPORT_EMAIL} if you need confirmation.
      </p>
      <h2>Contact</h2>
      <p>
        Privacy questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </>
  )
}

function TermsBody() {
  return (
    <>
      <p>
        By using Cadens you agree to use the service lawfully, respect other members in groups
        you join, and not attempt to access other users’ private data.
      </p>
      <h2>The service</h2>
      <p>
        Cadens is provided as-is. Features may change. We may suspend accounts that abuse the
        service, spam groups, or undermine security.
      </p>
      <h2>Your content</h2>
      <p>
        You retain rights to content you create. You grant us permission to store and process it
        solely to operate Cadens. Private journal and private saves are not for public
        distribution.
      </p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </>
  )
}

function DeleteBody() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleDelete() {
    if (!user) {
      navigate('/')
      return
    }
    const ok = window.confirm(
      'Delete all your Cadens data (saves, tasks, plan, journal, progress, notifications) and sign out? This cannot be undone.'
    )
    if (!ok) return
    setBusy(true)
    try {
      await deleteAccountAndSignOut(signOut)
      setDone(true)
      toast('Your Cadens data was deleted', 'success')
    } catch (e: any) {
      toast(e.message || 'Deletion failed — try again or email support', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p>
        Deleting your account removes <strong>your Cadens application data</strong> from our
        database (saves, tasks, calendar events, journal entries, progress posts you authored,
        notifications, and push subscriptions), then signs you out.
      </p>
      <h2>Before you continue</h2>
      <ul>
        <li>Export anything you need to keep (copy notes manually for now).</li>
        <li>Group messages and shared boards may retain history visible to other members.</li>
        <li>
          Full removal of the underlying auth user may require a follow-up with{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> if your provider still shows
          the login.
        </li>
      </ul>

      {done ? (
        <p className="text-[var(--color-ok)] font-semibold">
          Data wipe finished. You can close this page.
        </p>
      ) : (
        <div className="not-prose mt-6 space-y-3">
          <Button variant="danger" size="lg" disabled={busy || !user} onClick={handleDelete}>
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Deleting…
              </>
            ) : (
              'Delete my Cadens data'
            )}
          </Button>
          {!user && (
            <p className="text-sm text-[var(--color-dim)]">Sign in to delete your data.</p>
          )}
          <p className="text-xs text-[var(--color-mute)]">
            Requires SQL migration <code>12-account-deletion.sql</code> on your Supabase project.
          </p>
        </div>
      )}
    </>
  )
}
