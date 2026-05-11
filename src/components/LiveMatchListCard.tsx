import type { Timestamp } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicMatchReplay } from '../hooks/usePublicMatchReplay'
import { useTournamentListingMeta } from '../hooks/useTournamentListingMeta'
import { humanizeResultForMatch } from '../lib/humanizeResultText'
import { buildListingLiveFooter } from '../lib/publicMatchCardUtils'
import { teamAvatarLabel } from '../lib/teamAvatarLabel'
import { MatchScorecard } from './MatchScorecard'
import type { MatchDoc } from '../types/models'

const DAY_MS = 24 * 60 * 60 * 1000

function startedAtMs(match: MatchDoc): number | null {
  const st = match.startedAt as Timestamp | undefined
  if (!st || typeof st.toDate !== 'function') return null
  const ms = st.toDate().getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Live listing: show “won by …” only within 24h of match start (reduces stale cards). Not applied on Completed tab. */
function showListingResultLine(match: MatchDoc): boolean {
  const t = startedAtMs(match)
  if (t == null) return true
  return Date.now() < t + DAY_MS
}

type Props = {
  match: { id: string } & MatchDoc
  /** Live tab uses realtime updates; completed listing loads events once. */
  replayMode?: 'live' | 'completed'
}

export function LiveMatchListCard({ match, replayMode = 'live' }: Props) {
  /** Re-check 24h result window periodically while the card can still flip. */
  const [, setListingTick] = useState(0)

  const { cfg, state } = usePublicMatchReplay(
    match,
    !match.id || !match.isPublic ? 'off' : replayMode,
  )

  useEffect(() => {
    if (!state?.matchComplete) return
    const t0 = startedAtMs(match)
    if (t0 == null) return
    const deadline = t0 + DAY_MS
    const wait = deadline - Date.now()
    if (wait <= 0) return
    const id = window.setTimeout(() => setListingTick((n) => n + 1), wait + 50)
    return () => window.clearTimeout(id)
  }, [match.id, match.startedAt, state?.matchComplete])

  const suppressResultFooter =
    replayMode === 'completed'
      ? false
      : Boolean(state?.matchComplete) && !showListingResultLine(match)

  const headerMetaRight = useTournamentListingMeta(match)

  const listingLiveFooter =
    cfg && state && replayMode === 'live' ? buildListingLiveFooter(cfg, state, match.home.name, match.away.name) : null

  const listingHeaderMode =
    replayMode === 'completed'
      ? 'result'
      : state?.matchComplete
        ? 'result'
        : 'live'

  const inner =
    cfg && state ? (
      <MatchScorecard
        homeName={match.home.name}
        awayName={match.away.name}
        homeTeam={match.home}
        awayTeam={match.away}
        cfg={cfg}
        state={state}
        headerMode={listingHeaderMode}
        listingLayout
        headerMetaRight={headerMetaRight || null}
        listingLiveFooter={listingLiveFooter}
        resultSummaryText={match.resultSummary?.text}
        resultSummaryEndReason={match.resultSummary?.endReason}
        suppressResultFooter={suppressResultFooter}
        compact
      />
    ) : replayMode === 'completed' ? (
      <div className="match-scorecard match-scorecard--listing match-scorecard--placeholder">
        <div className="match-scorecard-head">
          <span className="match-scorecard-kicker match-scorecard-kicker--result">RESULT</span>
          {headerMetaRight ? (
            <span className="match-scorecard-meta match-scorecard-meta--listing">{headerMetaRight}</span>
          ) : (
            <span />
          )}
        </div>
        <div className="match-scorecard-row">
          <div className="match-scorecard-team">
            <span className="match-scorecard-avatar" aria-hidden>
              {teamAvatarLabel(match.home)}
            </span>
            <span className="match-scorecard-teamname">{match.home.name}</span>
          </div>
          <div className="match-scorecard-trailing">
            <div className="match-scorecard-score muted">—</div>
          </div>
        </div>
        <div className="match-scorecard-row">
          <div className="match-scorecard-team">
            <span className="match-scorecard-avatar" aria-hidden>
              {teamAvatarLabel(match.away)}
            </span>
            <span className="match-scorecard-teamname">{match.away.name}</span>
          </div>
          <div className="match-scorecard-trailing">
            <div className="match-scorecard-score muted">—</div>
          </div>
        </div>
        {match.resultSummary?.text ? (
          <p className="match-scorecard-result">{humanizeResultForMatch(match.resultSummary.text, match)}</p>
        ) : (
          <p className="match-scorecard-upcoming-footer muted small">Result unavailable</p>
        )}
      </div>
    ) : (
      <div className="match-scorecard match-scorecard--listing match-scorecard--placeholder">
        <div className="match-scorecard-head">
          <span className="match-scorecard-kicker-group">
            <span className="match-scorecard-live-dot" aria-hidden />
            <span className="match-scorecard-kicker match-scorecard-kicker--live">LIVE</span>
          </span>
          {headerMetaRight ? (
            <span className="match-scorecard-meta match-scorecard-meta--listing">{headerMetaRight}</span>
          ) : (
            <span />
          )}
        </div>
        <div className="match-scorecard-row">
          <div className="match-scorecard-team">
            <span className="match-scorecard-avatar" aria-hidden>
              {teamAvatarLabel(match.home)}
            </span>
            <span className="match-scorecard-teamname">{match.home.name}</span>
          </div>
          <div className="match-scorecard-trailing">
            <div className="match-scorecard-score muted">—</div>
          </div>
        </div>
        <div className="match-scorecard-row">
          <div className="match-scorecard-team">
            <span className="match-scorecard-avatar" aria-hidden>
              {teamAvatarLabel(match.away)}
            </span>
            <span className="match-scorecard-teamname">{match.away.name}</span>
          </div>
          <div className="match-scorecard-trailing">
            <div className="match-scorecard-score muted">—</div>
          </div>
        </div>
        <p className="match-scorecard-livefooter">
          {match.lineup ? 'Loading score…' : 'Match starting…'}
        </p>
      </div>
    )

  return (
    <Link to={`/live/${match.publicId}`} className="live-match-card-link">
      {inner}
    </Link>
  )
}
