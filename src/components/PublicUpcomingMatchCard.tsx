import { Link } from 'react-router-dom'
import { useTournamentListingMeta } from '../hooks/useTournamentListingMeta'
import { formatMatchListingSchedule, teamAbbrevFromName } from '../lib/publicMatchCardUtils'
import type { MatchDoc } from '../types/models'

function teamCircleInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return (parts[0] ?? '?').slice(0, 2).toUpperCase()
}

type Props = { match: { id: string } & MatchDoc }

export function PublicUpcomingMatchCard({ match }: Props) {
  const meta = useTournamentListingMeta(match)
  const { dayLine, timeLine } = formatMatchListingSchedule(match.scheduledAt)

  return (
    <Link to={`/live/${match.publicId}`} className="live-match-card-link">
      <div className="match-scorecard match-scorecard--listing">
        <div className="match-scorecard-head">
          <span className="match-scorecard-kicker match-scorecard-kicker--result">UPCOMING</span>
          {meta ? <span className="match-scorecard-meta match-scorecard-meta--listing">{meta}</span> : <span />}
        </div>

        <div className="match-scorecard-listing-upcoming-body">
          <div className="match-scorecard-listing-upcoming-teams">
            {[match.home, match.away].map((side, i) => (
              <div key={i} className="match-scorecard-listing-team-line">
                <span className="match-scorecard-avatar" aria-hidden>
                  {teamCircleInitials(side.name)}
                </span>
                <span className="match-scorecard-teamname">{teamAbbrevFromName(side.name)}</span>
              </div>
            ))}
          </div>
          <div className="match-scorecard-listing-time">
            {dayLine ? <span className="muted small match-scorecard-listing-time-day">{dayLine}</span> : null}
            {timeLine ? (
              <span className="match-scorecard-listing-time-clock">{timeLine}</span>
            ) : null}
          </div>
        </div>

        <p className="match-scorecard-upcoming-footer muted small">Match yet to begin</p>
      </div>
    </Link>
  )
}
