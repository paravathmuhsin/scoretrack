import type { Timestamp } from 'firebase/firestore'
import { collection, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDb } from '../firebase/config'
import { useTournamentListingMeta } from '../hooks/useTournamentListingMeta'
import { humanizeResultForMatch } from '../lib/humanizeResultText'
import { buildListingLiveFooter } from '../lib/publicMatchCardUtils'
import { scoreEventFromFirestore } from '../lib/matchEvents'
import { MatchScorecard } from './MatchScorecard'
import { replayEvents, type ReplayConfig, type ScoreEvent } from '../scoring/engine'
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

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const s = parts[0] ?? '?'
  return s.slice(0, 2).toUpperCase()
}

export function LiveMatchListCard({ match, replayMode = 'live' }: Props) {
  const [events, setEvents] = useState<ScoreEvent[]>([])
  /** Re-check 24h result window periodically while the card can still flip. */
  const [, setListingTick] = useState(0)

  useEffect(() => {
    if (!match.id || !match.isPublic) return
    const coll = collection(getDb(), 'matches', match.id, 'events')
    const qy = query(coll, orderBy('seq', 'asc'))

    if (replayMode === 'completed') {
      let cancelled = false
      void (async () => {
        try {
          const snap = await getDocs(qy)
          if (cancelled) return
          const out: ScoreEvent[] = []
          snap.forEach((d) => {
            const ev = scoreEventFromFirestore(d.data() as Parameters<typeof scoreEventFromFirestore>[0])
            if (ev) out.push(ev)
          })
          setEvents(out)
        } catch (e) {
          console.error('[LiveMatchListCard completed replay]', e)
          if (!cancelled) setEvents([])
        }
      })()
      return () => {
        cancelled = true
      }
    }

    return onSnapshot(qy, (snap) => {
      const out: ScoreEvent[] = []
      snap.forEach((d) => {
        const ev = scoreEventFromFirestore(d.data() as Parameters<typeof scoreEventFromFirestore>[0])
        if (ev) out.push(ev)
      })
      setEvents(out)
    })
  }, [match.id, match.isPublic, replayMode])

  const cfg: ReplayConfig | null = useMemo(() => {
    if (!match.lineup) return null
    return {
      squadSize: match.squadSize,
      oversLimit: match.oversLimit,
      ballsPerOver: match.ballsPerOver ?? 6,
      oversPerBowler: match.oversPerBowler ?? null,
      lineup: match.lineup,
      homeName: match.home.name,
      awayName: match.away.name,
    }
  }, [match])

  const state = useMemo(() => {
    if (!cfg) return null
    return replayEvents(cfg, events)
  }, [cfg, events])

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
              {teamInitials(match.home.name)}
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
              {teamInitials(match.away.name)}
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
              {teamInitials(match.home.name)}
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
              {teamInitials(match.away.name)}
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
