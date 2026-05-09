import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { PublicLayout } from './components/PublicLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RequireCompleteProfile } from './components/RequireCompleteProfile'
import { CompleteProfilePage } from './pages/CompleteProfilePage'
import { ProfilePage } from './pages/ProfilePage'
import { PublicMatchesPage } from './pages/PublicMatchesPage'
import { PublicTournamentDetailPage } from './pages/PublicTournamentDetailPage'
import { PublicTournamentsPage } from './pages/PublicTournamentsPage'
import { LoginPage } from './pages/LoginPage'
import { MatchFormPage } from './pages/MatchFormPage'
import { MatchOverlayManagePage } from './pages/MatchOverlayManagePage'
import { MatchSquadsPage } from './pages/MatchSquadsPage'
import { MatchesPage } from './pages/MatchesPage'
import { PublicLivePage } from './pages/PublicLivePage'
import { PublicOverlayPage } from './pages/PublicOverlayPage'
import { RegisterPage } from './pages/RegisterPage'
import { ScoreMatchPage } from './pages/ScoreMatchPage'
import { TeamEditPage } from './pages/TeamEditPage'
import { TeamsPage } from './pages/TeamsPage'
import { UserTeamCreatePage } from './pages/UserTeamCreatePage'
import { UserTeamEditPage } from './pages/UserTeamEditPage'
import { TournamentDetailPage } from './pages/TournamentDetailPage'
import { TournamentNewPage } from './pages/TournamentNewPage'
import { TournamentsPage } from './pages/TournamentsPage'
import { TournamentStatsPage } from './pages/TournamentStatsPage'

export const router = createBrowserRouter([
  /** Full-screen transparent OBS/browser-source page — no PublicLayout chrome. */
  { path: '/overlay/:publicId', element: <PublicOverlayPage /> },
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <PublicMatchesPage /> },
      { path: 'matches', element: <Navigate to="/" replace /> },
      { path: 'live/:publicId', element: <PublicLivePage /> },
      { path: 'tournaments', element: <PublicTournamentsPage /> },
      { path: 'tournaments/:id', element: <PublicTournamentDetailPage /> },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/app',
    element: <ProtectedRoute />,
    children: [
      { path: 'complete-profile', element: <CompleteProfilePage /> },
      {
        element: <RequireCompleteProfile />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/" replace /> },
              { path: 'profile', element: <ProfilePage /> },
              { path: 'teams', element: <TeamsPage /> },
              { path: 'teams/new', element: <UserTeamCreatePage /> },
              { path: 'teams/:teamId', element: <UserTeamEditPage /> },
              { path: 'tournaments', element: <TournamentsPage /> },
              { path: 'tournaments/new', element: <TournamentNewPage /> },
              { path: 'tournaments/:id', element: <TournamentDetailPage /> },
              { path: 'tournaments/:id/teams/:teamId', element: <TeamEditPage /> },
              { path: 'tournaments/:id/stats', element: <TournamentStatsPage /> },
              { path: 'matches', element: <MatchesPage /> },
              { path: 'matches/new', element: <MatchFormPage /> },
              { path: 'matches/:id/edit', element: <MatchFormPage /> },
              { path: 'matches/:id/squads', element: <MatchSquadsPage /> },
              { path: 'matches/:id/score', element: <ScoreMatchPage /> },
              { path: 'matches/:id/overlay', element: <MatchOverlayManagePage /> },
            ],
          },
        ],
      },
    ],
  },
])
