import { Link } from 'react-router-dom'
import { useTournamentListingMeta } from '../hooks/useTournamentListingMeta'
import { formatMatchListingSchedule } from '../lib/publicMatchCardUtils'
import { teamAvatarLabel } from '../lib/teamAvatarLabel'
import type { MatchDoc } from '../types/models'

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
                  {teamAvatarLabel(side)}
                </span>
                <span className="match-scorecard-teamname">{side.name}</span>
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
