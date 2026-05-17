import { usePublicMatchReplay } from '../hooks/usePublicMatchReplay'
import { buildTournamentMatchStatsLine } from '../lib/publicMatchCardUtils'
import { cn } from '../lib/utils'
import { matchCardRowContent } from '../lib/scoreLineFormat'
import type { ReplayState } from '../scoring/engine'
import type { MatchDoc, Side } from '../types/models'
import { MatchCardScoreRwOvers } from './MatchCardScoreRwOvers'

type Props = {
  match: { id: string } & MatchDoc
  /** Replay private fixtures for organisers (scores + stats on tournament admin). */
  allowPrivateReplay?: boolean
}

function scoreCell(rw: string | null, oversParen: string | null, statusOnly: string | null) {
  if (rw) return <MatchCardScoreRwOvers rw={rw} oversParen={oversParen} />
  if (statusOnly) return <span className="muted">{statusOnly}</span>
  return <span className="muted">—</span>
}

function tournamentScoreRowClass(side: Side, state: ReplayState): string {
  const isLoser =
    state.matchComplete && state.winner != null && state.winner !== 'tie' && state.winner !== side
  const completedInnings =
    Boolean(state.innings2) && !state.matchComplete && state.innings1.battingSide === side
  return cn(
    'public-tournament-match-score-row',
    completedInnings && 'public-tournament-match-score-row--completed-innings',
    isLoser && 'public-tournament-match-score-row--loser',
  )
}

/** Live / completed lines using the same overs rules as the score page (`inningsOversSummaryParen`). */
export function PublicTournamentMatchScoreLines({ match, allowPrivateReplay = false }: Props) {
  if (match.status === 'scheduled' || (!match.isPublic && !allowPrivateReplay)) return null

  const replayMode = match.status === 'live' ? 'live' : 'completed'
  const { cfg, state } = usePublicMatchReplay(match, replayMode, allowPrivateReplay)
  if (!cfg || !state) return null

  const home = matchCardRowContent(state, cfg, 'home')
  const away = matchCardRowContent(state, cfg, 'away')
  const statsLine = buildTournamentMatchStatsLine(match, cfg, state)

  return (
    <>
      <div className="public-tournament-match-score-lines">
        <div className={tournamentScoreRowClass('home', state)}>
          <span className="public-tournament-match-score-team">{match.home.name}</span>
          <span className="public-tournament-match-score-val">{scoreCell(home.rw, home.oversParen, home.statusOnly)}</span>
        </div>
        <div className={tournamentScoreRowClass('away', state)}>
          <span className="public-tournament-match-score-team">{match.away.name}</span>
          <span className="public-tournament-match-score-val">{scoreCell(away.rw, away.oversParen, away.statusOnly)}</span>
        </div>
      </div>
      {statsLine ? (
        state.matchComplete || match.status === 'completed' || match.status === 'abandoned' ? (
          <p className="score-live-result public-tournament-match-stats" role="status">
            {statsLine}
          </p>
        ) : (
          <div className="score-live-chase-strip public-tournament-match-stats" role="status">
            {statsLine}
          </div>
        )
      ) : null}
    </>
  )
}
