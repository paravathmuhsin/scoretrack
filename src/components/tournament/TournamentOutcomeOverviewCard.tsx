import { Medal, Star, Trophy } from 'lucide-react'
import type { TournamentOutcome } from '../../types/models'
import { OverviewDetailRow } from './tournamentPublicDisplay'

type Props = {
  outcome: TournamentOutcome
  teamLabel: (linkedTeamId: string) => string
  headingId?: string
}

export function TournamentOutcomeOverviewCard({ outcome, teamLabel, headingId = 'tournament-outcome-heading' }: Props) {
  const potm = outcome.playerOfTheTournament

  return (
    <section
      className="public-tournament-surface public-tournament-overview-card public-tournament-outcome-card"
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="public-tournament-overview-section-title public-tournament-outcome-title">
        Tournament result
      </h2>
      <div className="public-tournament-overview-rows public-tournament-outcome-rows">
        <OverviewDetailRow icon={Trophy} label="Winner">
          {teamLabel(outcome.winnerLinkedTeamId)}
        </OverviewDetailRow>
        <OverviewDetailRow icon={Medal} label="Runner-up">
          {teamLabel(outcome.runnerUpLinkedTeamId)}
        </OverviewDetailRow>
        <OverviewDetailRow icon={Star} label="Player of the tournament">
          {potm.name}
          {potm.source === 'manual' ? (
            <span className="public-tournament-outcome-note">Selected manually</span>
          ) : null}
        </OverviewDetailRow>
      </div>
    </section>
  )
}
