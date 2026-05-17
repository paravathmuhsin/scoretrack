import type { Timestamp } from 'firebase/firestore'
import { Calendar, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { TournamentDoc } from '../types/models'

export type TournamentListingRow = { id: string } & TournamentDoc

function shortCalDay(ts: Timestamp | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return ''
  return ts.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Date range for listing cards (no year). */
export function tournamentListingScheduleLine(t: TournamentDoc): string {
  const s = t.startDate as Timestamp | undefined
  const e = t.endDate as Timestamp | undefined
  const hasS = s && typeof s.toDate === 'function'
  const hasE = e && typeof e.toDate === 'function'

  if (hasS && hasE) {
    const a = shortCalDay(s)
    const b = shortCalDay(e)
    return a && b ? `${a} — ${b}` : a || b
  }
  if (hasS) return shortCalDay(s)
  if (hasE) {
    const end = shortCalDay(e)
    return end ? `Ends ${end}` : ''
  }
  return ''
}

function tournamentListingKicker(t: TournamentDoc): { label: string; upcoming: boolean } {
  if (t.tournamentOutcome) return { label: 'ENDED', upcoming: false }
  return { label: 'UPCOMING', upcoming: true }
}

export function TournamentListingCard({
  t,
  to,
  metaRight,
}: {
  t: TournamentListingRow
  to: string
  /** Teams / visibility — location is appended in the meta row. */
  metaRight: string
}) {
  const scheduleLine = tournamentListingScheduleLine(t)
  const loc = t.location?.trim()
  const metaBase = metaRight.trim()
  const showMeta = Boolean(metaBase || loc)
  const kicker = tournamentListingKicker(t)

  return (
    <Link to={to} className="live-match-card-link">
      <div className="match-scorecard match-scorecard--listing match-scorecard--tournament-listing">
        <div className="match-scorecard-head">
          <span
            className={
              kicker.upcoming
                ? 'match-scorecard-kicker match-scorecard-kicker--upcoming'
                : 'match-scorecard-kicker match-scorecard-kicker--result'
            }
          >
            {kicker.label}
          </span>
          {showMeta ? (
            <span className="match-scorecard-meta match-scorecard-meta--listing">
              {metaBase}
              {metaBase && loc ? (
                <span className="match-scorecard-meta-sep" aria-hidden>
                  ·
                </span>
              ) : null}
              {loc}
            </span>
          ) : (
            <span />
          )}
        </div>

        <div className="match-scorecard-listing-upcoming-body">
          <div className="match-scorecard-listing-upcoming-teams">
            <div className="match-scorecard-listing-team-line">
              <span className="match-scorecard-teamname match-scorecard-teamname--listing-title">{t.name}</span>
            </div>
          </div>

          {scheduleLine ? (
            <div className="match-scorecard-listing-schedule" aria-label={`Dates ${scheduleLine}`}>
              <Calendar className="match-scorecard-listing-schedule-icon" strokeWidth={2} aria-hidden />
              <span className="match-scorecard-listing-schedule-text">{scheduleLine}</span>
            </div>
          ) : null}
        </div>

        <div className="match-scorecard-listing-cta" aria-hidden>
          <span className="match-scorecard-listing-cta-text">Standings, fixtures & scores</span>
          <span className="match-scorecard-listing-cta-btn">
            <ChevronRight strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </Link>
  )
}
