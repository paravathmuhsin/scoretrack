import type { ReactElement } from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { PublicLayout } from './components/PublicLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RequireCompleteProfile } from './components/RequireCompleteProfile'
import { RoutePage, lazyPage } from './lazyRoute'

const PublicOverlayPage = lazyPage(() => import('./pages/PublicOverlayPage'), 'PublicOverlayPage')
const PublicMatchesPage = lazyPage(() => import('./pages/PublicMatchesPage'), 'PublicMatchesPage')
const PublicLivePage = lazyPage(() => import('./pages/PublicLivePage'), 'PublicLivePage')
const PublicPlayerStatsPage = lazyPage(
  () => import('./pages/PublicPlayerStatsPage'),
  'PublicPlayerStatsPage',
)
const PublicTournamentsPage = lazyPage(
  () => import('./pages/PublicTournamentsPage'),
  'PublicTournamentsPage',
)
const PublicTournamentDetailPage = lazyPage(
  () => import('./pages/PublicTournamentDetailPage'),
  'PublicTournamentDetailPage',
)
const LoginPage = lazyPage(() => import('./pages/LoginPage'), 'LoginPage')
const RegisterPage = lazyPage(() => import('./pages/RegisterPage'), 'RegisterPage')
const CompleteProfilePage = lazyPage(
  () => import('./pages/CompleteProfilePage'),
  'CompleteProfilePage',
)
const TeamJoinInvitePage = lazyPage(
  () => import('./pages/TeamJoinInvitePage'),
  'TeamJoinInvitePage',
)
const ProfilePage = lazyPage(() => import('./pages/ProfilePage'), 'ProfilePage')
const MyStatsPage = lazyPage(() => import('./pages/MyStatsPage'), 'MyStatsPage')
const TeamsPage = lazyPage(() => import('./pages/TeamsPage'), 'TeamsPage')
const UserTeamCreatePage = lazyPage(
  () => import('./pages/UserTeamCreatePage'),
  'UserTeamCreatePage',
)
const UserTeamEditPage = lazyPage(() => import('./pages/UserTeamEditPage'), 'UserTeamEditPage')
const NotificationsPage = lazyPage(() => import('./pages/NotificationsPage'), 'NotificationsPage')
const TournamentsPage = lazyPage(() => import('./pages/TournamentsPage'), 'TournamentsPage')
const TournamentNewPage = lazyPage(() => import('./pages/TournamentNewPage'), 'TournamentNewPage')
const TournamentDetailPage = lazyPage(
  () => import('./pages/TournamentDetailPage'),
  'TournamentDetailPage',
)
const TeamEditPage = lazyPage(() => import('./pages/TeamEditPage'), 'TeamEditPage')
const TournamentStatsPage = lazyPage(
  () => import('./pages/TournamentStatsPage'),
  'TournamentStatsPage',
)
const MatchesPage = lazyPage(() => import('./pages/MatchesPage'), 'MatchesPage')
const MatchFormPage = lazyPage(() => import('./pages/MatchFormPage'), 'MatchFormPage')
const MatchSquadsPage = lazyPage(() => import('./pages/MatchSquadsPage'), 'MatchSquadsPage')
const ScoreMatchPage = lazyPage(() => import('./pages/ScoreMatchPage'), 'ScoreMatchPage')
const MatchOverlayManagePage = lazyPage(
  () => import('./pages/MatchOverlayManagePage'),
  'MatchOverlayManagePage',
)
const FirebaseAuthCallbackPage = lazyPage(
  () => import('./pages/FirebaseAuthCallbackPage'),
  'FirebaseAuthCallbackPage',
)

function page(element: ReactElement) {
  return <RoutePage>{element}</RoutePage>
}

export const router = createBrowserRouter([
  /** Full-screen transparent OBS/browser-source page — no PublicLayout chrome. */
  { path: '/overlay/:publicId', element: page(<PublicOverlayPage />) },
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: page(<PublicMatchesPage />) },
      { path: 'matches', element: <Navigate to="/" replace /> },
      { path: 'live/:publicId', element: page(<PublicLivePage />) },
      { path: 'player/:playerId', element: page(<PublicPlayerStatsPage />) },
      { path: 'tournaments', element: page(<PublicTournamentsPage />) },
      { path: 'tournaments/:id', element: page(<PublicTournamentDetailPage />) },
    ],
  },
  { path: '/login', element: page(<LoginPage />) },
  { path: '/register', element: page(<RegisterPage />) },
  /** Firebase OAuth redirect target — must exist or Google sign-in shows React Router 404. */
  { path: '/__/auth/*', element: page(<FirebaseAuthCallbackPage />) },
  {
    path: '/app',
    element: <ProtectedRoute />,
    children: [
      { path: 'complete-profile', element: page(<CompleteProfilePage />) },
      { path: 'join/team/:token', element: page(<TeamJoinInvitePage />) },
      {
        element: <RequireCompleteProfile />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/" replace /> },
              { path: 'profile', element: page(<ProfilePage />) },
              { path: 'notifications', element: page(<NotificationsPage />) },
              { path: 'my-stats', element: page(<MyStatsPage />) },
              { path: 'teams', element: page(<TeamsPage />) },
              { path: 'teams/new', element: page(<UserTeamCreatePage />) },
              { path: 'teams/:teamId', element: page(<UserTeamEditPage />) },
              { path: 'tournaments', element: page(<TournamentsPage />) },
              { path: 'tournaments/new', element: page(<TournamentNewPage />) },
              { path: 'tournaments/:id', element: page(<TournamentDetailPage />) },
              { path: 'tournaments/:id/teams/:teamId', element: page(<TeamEditPage />) },
              { path: 'tournaments/:id/stats', element: page(<TournamentStatsPage />) },
              { path: 'matches', element: page(<MatchesPage />) },
              { path: 'matches/new', element: page(<MatchFormPage />) },
              { path: 'matches/:id/edit', element: page(<MatchFormPage />) },
              { path: 'matches/:id/squads', element: page(<MatchSquadsPage />) },
              { path: 'matches/:id/score', element: page(<ScoreMatchPage />) },
              { path: 'matches/:id/overlay', element: page(<MatchOverlayManagePage />) },
            ],
          },
        ],
      },
    ],
  },
])
