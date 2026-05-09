import { humanizeResultSidesInText } from '../lib/humanizeResultText'
import { isInningsOver, opp, oversString, type ReplayConfig, type ReplayState } from '../scoring/engine'
import type { Side } from '../types/models'

export type MatchScorecardProps = {
  homeName: string
  awayName: string
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
  scoreText: string | null
  centerText: string | null
}

function buildRows(
  cfg: ReplayConfig,
  state: ReplayState,
  opts?: { listingLayout?: boolean },
): [RowModel, RowModel] {
  const firstBat = state.innings1.battingSide
  const secondBat = opp(firstBat)
  const i1 = state.innings1
  const i2 = state.innings2
  const listingHideChaseCenter =
    Boolean(opts?.listingLayout) &&
    Boolean(i2) &&
    !state.matchComplete &&
    state.activeInnings === 2

  const rowFor = (side: Side): RowModel => {
    if (side === firstBat) {
      const scoreText = `${i1.runs}/${i1.wickets}`
      let centerText: string | null = null
      const inn1Live = !isInningsOver(cfg, i1, state)
      if (!i2 && !state.matchComplete && state.activeInnings === 1 && inn1Live) {
        centerText = `(${oversString(i1.legalBalls, cfg.ballsPerOver)}/${cfg.oversLimit} ov)`
      }
      return { side, scoreText, centerText }
    }

    if (!i2) {
      const scoreText = null
      const centerText = state.matchComplete ? null : 'Yet to bat'
      return { side, scoreText, centerText }
    }

    const target = i1.runs + 1
    const centerText =
      listingHideChaseCenter
        ? null
        : `(${oversString(i2.legalBalls, cfg.ballsPerOver)}/${cfg.oversLimit} ov, T:${target})`
    return {
      side,
      scoreText: `${i2.runs}/${i2.wickets}`,
      centerText,
    }
  }

  return [rowFor(firstBat), rowFor(secondBat)]
}

export function MatchScorecard({
  homeName,
  awayName,
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
  const [rowA, rowB] = buildRows(cfg, state, { listingLayout })

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
        row={rowA}
        loser={loserSide === rowA.side}
      />
      <ScorecardRow
        homeName={homeName}
        awayName={awayName}
        row={rowB}
        loser={loserSide === rowB.side}
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
  loser,
}: {
  row: RowModel
  homeName: string
  awayName: string
  loser?: boolean
}) {
  const name = sideName(row.side, homeName, awayName)
  const initials = teamInitials(name)
  const hasScore = row.scoreText != null && row.scoreText !== ''
  const metaBesideScore = Boolean(row.centerText && hasScore)
  const statusOnly = Boolean(row.centerText && !hasScore)

  return (
    <div className={'match-scorecard-row' + (loser ? ' match-scorecard-row--loser' : '')}>
      <div className="match-scorecard-team">
        <span className="match-scorecard-avatar" aria-hidden>
          {initials}
        </span>
        <span className="match-scorecard-teamname">{name}</span>
      </div>
      <div className="match-scorecard-trailing">
        {metaBesideScore ? (
          <span className="match-scorecard-meta-inline">{row.centerText}</span>
        ) : null}
        <div className="match-scorecard-score">
          {hasScore ? (
            row.scoreText
          ) : statusOnly ? (
            <span className="match-scorecard-status muted">{row.centerText}</span>
          ) : (
            <span className="muted">—</span>
          )}
        </div>
      </div>
    </div>
  )
}
