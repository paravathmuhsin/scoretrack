import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

/** Primary navigation (public browse + signed-in app links). */
export function MainNav() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const matchesBrowseActive =
    pathname === '/' || pathname === '/matches' || pathname.startsWith('/live/')
  const tournamentsBrowseActive = pathname.startsWith('/tournaments')

  return (
    <nav className="nav">
      <NavLink
        to="/"
        end
        className={({ isActive }) => (isActive || matchesBrowseActive ? 'active' : '')}
      >
        Matches
      </NavLink>
      <NavLink
        to="/tournaments"
        className={({ isActive }) => (isActive || tournamentsBrowseActive ? 'active' : '')}
      >
        Tournaments
      </NavLink>
      {user && (
        <>
          <NavLink to="/app/profile">Profile</NavLink>
          <NavLink to="/app/tournaments">My tournaments</NavLink>
          <NavLink to="/app/teams">My teams</NavLink>
          <NavLink to="/app/matches">My matches</NavLink>
        </>
      )}
    </nav>
  )
}
