import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AppShell from './app/AppShell'
import { ChatProvider } from './app/chat'
import { SessionProvider, useSessionState } from './app/session'
import { ToastProvider } from './components/toast'
import AuthScreen from './screens/AuthScreen'
import FriendScreen from './screens/FriendScreen'
import GroupScreen from './screens/GroupScreen'
import InboxScreen from './screens/InboxScreen'
import Onboarding from './screens/Onboarding'
import ProfileScreen from './screens/ProfileScreen'
import RankingScreen from './screens/RankingScreen'
import SettingsScreen from './screens/SettingsScreen'
import StatsScreen from './screens/StatsScreen'
import TodayScreen from './screens/TodayScreen'

// Chat screens load on first use, to keep the main bundle small.
const ChatListScreen = lazy(() => import('./screens/ChatListScreen'))
const ChatThreadScreen = lazy(() => import('./screens/ChatThreadScreen'))

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" className="size-16 animate-pulse rounded-[20px]" />
    </div>
  )
}

function Gate() {
  const state = useSessionState()
  if (state.status === 'loading') return <Splash />
  if (state.status === 'signed-out') return <AuthScreen />
  if (state.session.groups.length === 0) return <Onboarding />
  return (
    <ChatProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<TodayScreen />} />
          <Route path="ranking" element={<RankingScreen />} />
          <Route path="stats" element={<StatsScreen />} />
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="friend/:userId" element={<FriendScreen />} />
          <Route path="groups" element={<GroupScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="inbox" element={<InboxScreen />} />
          <Route path="chat" element={<Suspense><ChatListScreen /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        {/* Full screen, no tab bar: the message box sits at the bottom. */}
        <Route path="chat/:id" element={<Suspense fallback={<Splash />}><ChatThreadScreen /></Suspense>} />
      </Routes>
    </ChatProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ToastProvider>
        <SessionProvider>
          <Gate />
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
