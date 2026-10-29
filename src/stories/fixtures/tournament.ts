import type { StandingsDoc, TournamentDoc, TournamentOutcome } from '@/types/models'
import { ts } from './timestamp'

export function makeTournamentDoc(overrides: Partial<TournamentDoc> = {}): TournamentDoc {
  return {
    name: 'Summer Premier League',
    createdBy: 'demo-user',
    isPublic: true,
    createdAt: ts('2026-03-01T10:00:00Z'),
    teamCount: 8,
    location: 'Mumbai',
    startDate: ts('2026-04-01T00:00:00Z'),
    endDate: ts('2026-06-30T00:00:00Z'),
    defaultSquadSize: 11,
    defaultOversLimit: 20,
    ...overrides,
  }
}

export function makeTournamentWithId(overrides: Partial<TournamentDoc> = {}) {
  return { id: 'tournament-demo', ...makeTournamentDoc(overrides) }
}

export function makeStandingsDoc(): StandingsDoc {
  return {
    updatedAt: ts('2026-04-10T12:00:00Z'),
    teams: [
      {
        teamId: 'lt-1',
        teamName: 'North Stars',
        played: 4,
        won: 3,
        lost: 1,
        tied: 0,
        nr: 0,
        points: 6,
        runsFor: 640,
        oversFor: 80,
        runsAgainst: 580,
        oversAgainst: 78,
        nrr: 0.85,
      },
      {
        teamId: 'lt-2',
        teamName: 'Coastal Kings',
        played: 4,
        won: 2,
        lost: 2,
        tied: 0,
        nr: 0,
        points: 4,
        runsFor: 590,
        oversFor: 79,
        runsAgainst: 600,
        oversAgainst: 80,
        nrr: 0.12,
      },
    ],
  }
}

export function makeTournamentOutcome(): TournamentOutcome {
  return {
    endedAt: ts('2026-06-28T18:00:00Z'),
    winnerLinkedTeamId: 'lt-1',
    runnerUpLinkedTeamId: 'lt-2',
    playerOfTheTournament: {
      playerId: 'home-1',
      name: 'Alex Kohli',
      teamId: 'lt-1',
      source: 'default',
    },
  }
}
