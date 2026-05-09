import type { Timestamp } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { formatTournamentDate } from '../lib/tournamentFormUtils'
import type { TournamentDoc } from '../types/models'

export type TournamentListingRow = { id: string } & TournamentDoc

function shortCalDay(ts: Timestamp | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return ''
  return ts.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Two-line rhythm: day line + emphasis line (matches public match listing cards). */
export function tournamentListingScheduleParts(
  t: TournamentDoc,
): { dayLine: string; timeLine: string } {
  const s = t.startDate as Timestamp | undefined
  const e = t.endDate as Timestamp | undefined
  const hasS = s && typeof s.toDate === 'function'
  const hasE = e && typeof e.toDate === 'function'

  if (hasS && hasE) {
    const ys = s.toDate().getFullYear()
    const ye = e.toDate().getFullYear()
    const a = shortCalDay(s)
    const b = shortCalDay(e)
    return {
      dayLine: `${a} — ${b}`,
      timeLine: ys === ye ? String(ys) : `${ys}–${ye}`,
    }
  }
  if (hasS) return { dayLine: formatTournamentDate(s), timeLine: '' }
  if (hasE) return { dayLine: `Ends ${formatTournamentDate(e)}`, timeLine: '' }
  return { dayLine: '', timeLine: '' }
}

export function TournamentListingCard({
  t,
  to,
  metaRight,
}: {
  t: TournamentListingRow
  to: string
  metaRight: string
}) {
  const { dayLine: scheduleDayLine, timeLine: scheduleTimeLine } = tournamentListingScheduleParts(t)
  const loc = t.location?.trim()

  return (
    <Link to={to} className="live-match-card-link">
      <div className="match-scorecard match-scorecard--listing">
        <div className="match-scorecard-head">
          <span className="match-scorecard-kicker match-scorecard-kicker--result">TOURNAMENT</span>
          <span className="match-scorecard-meta match-scorecard-meta--listing">{metaRight}</span>
        </div>

        <div className="match-scorecard-listing-upcoming-body">
          <div className="match-scorecard-listing-upcoming-teams">
            <div className="match-scorecard-listing-team-line">
              <span className="match-scorecard-teamname">{t.name}</span>
            </div>
            {loc ? (
              <p className="muted mb-0 mt-2 text-[0.78rem] leading-snug">{loc}</p>
            ) : null}
          </div>

          {(scheduleDayLine || scheduleTimeLine) && (
            <div className="match-scorecard-listing-time">
              {scheduleDayLine ? (
                <span className="muted small match-scorecard-listing-time-day">{scheduleDayLine}</span>
              ) : null}
              {scheduleTimeLine ? (
                <span className="match-scorecard-listing-time-clock">{scheduleTimeLine}</span>
              ) : null}
            </div>
          )}
        </div>

        <p className="match-scorecard-upcoming-footer muted small">Standings, fixtures & scores</p>
      </div>
    </Link>
  )
}
