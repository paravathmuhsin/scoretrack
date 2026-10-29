import type { TeamDoc, TournamentLinkedTeamDoc } from '@/types/models'

export function makeTeamDoc(overrides: Partial<TeamDoc> = {}): TeamDoc {
  return {
    name: 'North Stars',
    shortName: 'NST',
    location: 'Mumbai',
    players: [
      { playerId: 'home-1', name: 'Alex Kohli' },
      { playerId: 'home-2', name: 'Jordan Patel' },
    ],
    ownerIds: ['demo-user'],
    teamNumber: 42,
    ...overrides,
  }
}

export function makeLinkedTeam(
  overrides: Partial<TournamentLinkedTeamDoc> = {},
): TournamentLinkedTeamDoc & { id: string } {
  return {
    id: 'lt-1',
    userTeamId: 'team-1',
    userTeamOwnerUid: 'demo-user',
    teamName: 'North Stars',
    teamNumber: 42,
    linkApprovalStatus: 'accepted',
    ...overrides,
  }
}
