import type { StatsDoc } from '@/types/models'
import { ts } from './timestamp'

export function makeStatsDoc(): StatsDoc {
  return {
    updatedAt: ts('2026-04-10T12:00:00Z'),
    players: [
      {
        playerId: 'home-1',
        name: 'Alex Kohli',
        teamId: 'lt-1',
        runs: 240,
        balls: 180,
        wickets: 0,
        oversBowled: 0,
        runsConceded: 0,
        fieldingDismissals: 2,
        mvpScore: 92,
        fours: 18,
        sixes: 8,
      },
      {
        playerId: 'away-3',
        name: 'Sam Sharma',
        teamId: 'lt-2',
        runs: 45,
        balls: 120,
        wickets: 12,
        oversBowled: 40,
        runsConceded: 280,
        fieldingDismissals: 0,
        mvpScore: 88,
      },
    ],
  }
}
