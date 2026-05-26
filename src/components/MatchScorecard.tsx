import { humanizeResultSidesInText } from '../lib/humanizeResultText'
import { matchCardRowContent } from '../lib/scoreLineFormat'
import { teamAvatarLabel } from '../lib/teamAvatarLabel'
import { MatchCardScoreRwOvers } from './MatchCardScoreRwOvers'
import { currentInnings, opp, type ReplayConfig, type ReplayState } from '../scoring/engine'
import type { MatchTeamSnapshot, Side } from '../types/models'

export type MatchScorecardProps = {
  homeName: string
  awayName: string
  /** When set, circle avatar uses squad short name (via {@link teamAvatarLabel}). */
  homeTeam?: Pick<MatchTeamSnapshot, 'name' | 'shortName'>
  awayTeam?: Pick<MatchTeamSnapshot, 'name' | 'shortName'>
  cfg: ReplayConfig
  state: ReplayState
  /** Top-left label */
  headerMode: 'live' | 'result'
  /** IPL-style home listing (live dot, meta header). */
  listingLayout?: boolean
  /** Top-right tournament / venue line when `listingLayout` */
  headerMetaRight?: string | null
  /** Footer line for in-progress listing cards (black text) */
  listingLiveFooter?: string | null
  /** Top-right context (e.g. `20 overs · T20`) */
  subtitle?: string
  /** Completed match summary from DB when available */
  resultSummaryText?: string | null
  /** Note when organiser ended match from settings */
  resultSummaryEndReason?: string | null
  /** Hide recent-balls line (e.g. `/live` index cards) */
  compact?: boolean
  /** When true, never show the “won by …” result line (scores still shown). */
  suppressResultFooter?: boolean
}

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const s = parts[0] ?? '?'
  return s.slice(0, 2).toUpperCase()
}

function sideName(side: Side, homeName: string, awayName: string): string {
  return side === 'home' ? homeName : awayName
}

/** Replace raw side keys in engine strings with team names */
function humanResult(state: ReplayState, homeName: string, awayName: string): string | null {
  const raw = state.resultText
  if (!raw) return null
  return humanizeResultSidesInText(raw, homeName, awayName)
}

type RowModel = {
  side: Side
  rw: string | null
  oversParen: string | null
  statusOnly: string | null
}

function buildRows(cfg: ReplayConfig, state: ReplayState): [RowModel, RowModel] {
  const firstBat = state.innings1.battingSide
  const secondBat = opp(firstBat)

  const rowFor = (side: Side): RowModel => {
    const { rw, oversParen, statusOnly } = matchCardRowContent(state, cfg, side)
    return { side, rw, oversParen, statusOnly }
  }

  return [rowFor(firstBat), rowFor(secondBat)]
}

export function MatchScorecard({
  homeName,
  awayName,
  homeTeam,
  awayTeam,
  cfg,
  state,
  headerMode,
  listingLayout = false,
  headerMetaRight = null,
  listingLiveFooter = null,
  subtitle,
  resultSummaryText,
  resultSummaryEndReason,
  compact = false,
  suppressResultFooter = false,
}: MatchScorecardProps) {
  const [rowA, rowB] = buildRows(cfg, state)

  /** Prefer replay-derived line when complete so wording stays in sync with engine (team names + margins). */
  const replayLine = humanResult(state, homeName, awayName)
  const rawFooter =
    state.matchComplete && replayLine
      ? replayLine
      : resultSummaryText?.trim() || replayLine
  const footer =
    !suppressResultFooter && state.matchComplete && rawFooter
      ? humanizeResultSidesInText(rawFooter, homeName, awayName)
      : null

  const metaText = listingLayout ? (headerMetaRight?.trim() ?? '') : (subtitle ?? '')
  const showMeta = Boolean(metaText)

  const loserSide: Side | null =
    state.matchComplete && state.winner && state.winner !== 'tie' ? opp(state.winner) : null
  /** First innings side while chase is live — same de-emphasis as score page `.score-live-side--completed-innings`. */
  const completedInningsSide: Side | null =
    state.innings2 && !state.matchComplete ? state.innings1.battingSide : null
  const currentBattingSide: Side | null = !state.matchComplete
    ? currentInnings(state).battingSide
    : null

  return (
    <div className={'match-scorecard' + (listingLayout ? ' match-scorecard--listing' : '')}>
      <div className="match-scorecard-head">
        {listingLayout ? (
          <span className="match-scorecard-kicker-group">
            {headerMode === 'live' && <span className="match-scorecard-live-dot" aria-hidden />}
            <span
              className={
                headerMode === 'live'
                  ? 'match-scorecard-kicker match-scorecard-kicker--live'
                  : 'match-scorecard-kicker match-scorecard-kicker--result'
              }
            >
              {headerMode === 'live' ? 'LIVE' : 'RESULT'}
            </span>
          </span>
        ) : (
          <span className="match-scorecard-kicker">{headerMode === 'live' ? 'LIVE' : 'RESULT'}</span>
        )}
        {showMeta ? (
          <span
            className={
              'match-scorecard-meta' + (listingLayout ? ' match-scorecard-meta--listing' : '')
            }
          >
            {metaText}
          </span>
        ) : (
          <span />
        )}
      </div>

      <ScorecardRow
        homeName={homeName}
        awayName={awayName}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        row={rowA}
        loser={loserSide === rowA.side}
        completedInnings={completedInningsSide === rowA.side}
        inactiveBatting={
          currentBattingSide != null && rowA.side !== currentBattingSide
        }
      />
      <ScorecardRow
        homeName={homeName}
        awayName={awayName}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        row={rowB}
        loser={loserSide === rowB.side}
        completedInnings={completedInningsSide === rowB.side}
        inactiveBatting={
          currentBattingSide != null && rowB.side !== currentBattingSide
        }
      />

      {listingLayout && listingLiveFooter && !state.matchComplete && (
        <p className="match-scorecard-livefooter">{listingLiveFooter}</p>
      )}
      {footer && <p className="match-scorecard-result">{footer}</p>}
      {footer && resultSummaryEndReason?.trim() && (
        <p className="match-scorecard-result muted small" style={{ marginTop: '0.2rem' }}>
          <strong>Reason:</strong> {resultSummaryEndReason.trim()}
        </p>
      )}

      {!compact && !listingLayout && !footer && !state.matchComplete && (
        <p className="match-scorecard-livehint">
          Recent: {state.recentBalls.length ? state.recentBalls.join(' ') : '—'}
        </p>
      )}
    </div>
  )
}

function ScorecardRow({
  row,
  homeName,
  awayName,
  homeTeam,
  awayTeam,
  loser,
  completedInnings,
  inactiveBatting,
}: {
  row: RowModel
  homeName: string
  awayName: string
  homeTeam?: Pick<MatchTeamSnapshot, 'name' | 'shortName'>
  awayTeam?: Pick<MatchTeamSnapshot, 'name' | 'shortName'>
  loser?: boolean
  completedInnings?: boolean
  /** Team not currently batting (yet to bat or innings complete while chase is live). */
  inactiveBatting?: boolean
}) {
  const name = sideName(row.side, homeName, awayName)
  const snap = row.side === 'home' ? homeTeam : awayTeam
  const avatarLabel = snap ? teamAvatarLabel(snap) : teamInitials(name)
  const hasScore = row.rw != null && row.rw !== ''
  const statusOnly = Boolean(row.statusOnly && !hasScore)

  const rowClass =
    'match-scorecard-row' +
    (loser ? ' match-scorecard-row--loser' : '') +
    (completedInnings ? ' match-scorecard-row--completed-innings' : '') +
    (inactiveBatting ? ' match-scorecard-row--inactive-batting' : '')

  return (
    <div className={rowClass}>
      <div className="match-scorecard-team">
        <span className="match-scorecard-avatar" aria-hidden>
          {avatarLabel}
        </span>
        <span className="match-scorecard-teamname">{name}</span>
      </div>
      <div className="match-scorecard-trailing">
        <div className="match-scorecard-score match-scorecard-score--line">
          {hasScore && row.rw ? (
            <MatchCardScoreRwOvers rw={row.rw} oversParen={row.oversParen} />
          ) : statusOnly ? (
            <span className="match-scorecard-status muted">{row.statusOnly}</span>
          ) : (
            <span className="muted">—</span>
          )}
        </div>
      </div>
    </div>
  )
}
