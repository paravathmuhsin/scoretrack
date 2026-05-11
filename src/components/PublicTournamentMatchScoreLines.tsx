import { usePublicMatchReplay } from '../hooks/usePublicMatchReplay'
import { matchCardRowContent } from '../lib/scoreLineFormat'
import type { MatchDoc } from '../types/models'
import { MatchCardScoreRwOvers } from './MatchCardScoreRwOvers'

type Props = { match: { id: string } & MatchDoc }

function scoreCell(rw: string | null, oversParen: string | null, statusOnly: string | null) {
  if (rw) return <MatchCardScoreRwOvers rw={rw} oversParen={oversParen} />
  if (statusOnly) return <span className="muted">{statusOnly}</span>
  return <span className="muted">—</span>
}

/** Live / completed lines using the same overs rules as the score page (`inningsOversSummaryParen`). */
export function PublicTournamentMatchScoreLines({ match }: Props) {
  if (match.status === 'scheduled' || !match.isPublic) return null

  const replayMode = match.status === 'live' ? 'live' : 'completed'
  const { cfg, state } = usePublicMatchReplay(match, replayMode)
  if (!cfg || !state) return null

  const home = matchCardRowContent(state, cfg, 'home')
  const away = matchCardRowContent(state, cfg, 'away')

  return (
    <div className="public-tournament-match-score-lines">
      <div className="public-tournament-match-score-row">
        <span className="public-tournament-match-score-team">{match.home.name}</span>
        <span className="public-tournament-match-score-val">{scoreCell(home.rw, home.oversParen, home.statusOnly)}</span>
      </div>
      <div className="public-tournament-match-score-row">
        <span className="public-tournament-match-score-team">{match.away.name}</span>
        <span className="public-tournament-match-score-val">{scoreCell(away.rw, away.oversParen, away.statusOnly)}</span>
      </div>
    </div>
  )
}
