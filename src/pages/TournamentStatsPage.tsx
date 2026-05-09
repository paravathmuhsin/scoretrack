import { useParams } from 'react-router-dom'
import { TournamentPointsPanel } from '../components/TournamentPointsPanel'

export function TournamentStatsPage() {
  const { id } = useParams()
  if (!id) return <p>Missing id</p>
  return <TournamentPointsPanel tournamentId={id} variant="fullPage" />
}
