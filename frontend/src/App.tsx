import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout/AppShell'
import { AuthPage } from '@/pages/AuthPage'
const SavesPage=lazy(()=>import('@/pages/SavesPage').then(m=>({default:m.SavesPage})))
const ProgressPage=lazy(()=>import('@/pages/ProgressPage').then(m=>({default:m.ProgressPage})))
const GroupsPage=lazy(()=>import('@/pages/GroupsPage').then(m=>({default:m.GroupsPage})))
const GroupSettingsPage=lazy(()=>import('@/pages/GroupSettingsPage').then(m=>({default:m.GroupSettingsPage})))
const IdeaBoardPage=lazy(()=>import('@/pages/IdeaBoardPage').then(m=>({default:m.IdeaBoardPage})))
const ProfilePage=lazy(()=>import('@/pages/ProfilePage').then(m=>({default:m.ProfilePage})))
const MessagesPage=lazy(()=>import('@/pages/MessagesPage').then(m=>({default:m.MessagesPage})))
const JournalPage=lazy(()=>import('@/pages/JournalPage').then(m=>({default:m.JournalPage})))
const CalendarPage=lazy(()=>import('@/pages/CalendarPage').then(m=>({default:m.CalendarPage})))
const TasksPage=lazy(()=>import('@/pages/TasksPage').then(m=>({default:m.TasksPage})))
const LegalPage=lazy(()=>import('@/pages/LegalPage').then(m=>({default:m.LegalPage})))
const NotificationsPage=lazy(()=>import('@/pages/NotificationsPage').then(m=>({default:m.NotificationsPage})))
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { ToastProvider } from '@/components/ui/Toast'
import { TodayPage } from '@/pages/TodayPage'

function WelcomeRedirect() {
  useEffect(() => { window.location.replace('/welcome.html') }, [])
  return <LoadingScreen />
}

/** Today is the signed-in home; retain the supplied public landing page. */
export default function App() {
  const { user, loading, recovery } = useAuth()
  const callbackParams = new URLSearchParams(location.search)
  const hasAuthCallback = recovery || callbackParams.has('code') || callbackParams.has('error') ||
    /(?:access_token|refresh_token|error)=/.test(location.hash)

  // Render the destination immediately on explicit auth routes. Session loading
  // disables submission inside AuthPage without swapping in an unrelated splash.
  if (loading && !['/signup', '/signin', '/login', '/reset'].includes(location.pathname)) return <LoadingScreen />

  if (!user || recovery) {
    return (
      <ToastProvider>
        <Suspense fallback={<LoadingScreen />}><Routes>
          <Route path="/legal/:doc" element={<LegalPage />} />
          <Route path="/" element={hasAuthCallback ? <AuthPage /> : <WelcomeRedirect />} />
          <Route path="*" element={<AuthPage />} />
        </Routes></Suspense>
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <AppShell key={user.id}>
        <Suspense fallback={<LoadingScreen />}><Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/saves" element={<SavesPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/people" element={<GroupsPage />} />
          <Route path="/people/:groupId" element={<GroupSettingsPage />} />
          <Route path="/people/:groupId/ideas" element={<IdeaBoardPage />} />
          <Route path="/people/:groupId/ideas/:boardId" element={<IdeaBoardPage />} />
          <Route path="/you" element={<ProfilePage />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/legal/:doc" element={<LegalPage />} />
          <Route path="/groups" element={<Navigate to="/people" replace />} />
          <Route path="/groups/:groupId" element={<Navigate to="/people" replace />} />
          <Route path="/explore" element={<Navigate to="/" replace />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<Navigate to="/you" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></Suspense>
      </AppShell>
    </ToastProvider>
  )
}
