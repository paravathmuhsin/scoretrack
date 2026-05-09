import type { TournamentRoundType } from '../types/models'

export const TOURNAMENT_ROUND_OPTIONS: { value: TournamentRoundType; label: string }[] = [
  { value: 'league', label: 'League (group stage)' },
  { value: 'knockout', label: 'Knockout' },
  { value: 'quarter_final', label: 'Quarter final' },
  { value: 'semi_final', label: 'Semi final' },
  { value: 'final', label: 'Final' },
]

export function buildTournamentFixtureLabel(
  homeName: string,
  awayName: string,
  round: TournamentRoundType,
  groupName?: string,
): string {
  const rl = TOURNAMENT_ROUND_OPTIONS.find((o) => o.value === round)?.label ?? round
  if (round === 'league' && groupName) return `League · ${groupName}`
  return `${rl} · ${homeName} vs ${awayName}`
}
