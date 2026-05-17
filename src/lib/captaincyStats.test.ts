import { describe, expect, it } from 'vitest'
import { captaincyIncrementsForPlayer, resolveMatchWinnerForStats } from './captaincyStats'
import type { MatchDoc } from '../types/models'
import type { ReplayState } from '../scoring/engine'

function baseMatch(overrides: Partial<MatchDoc> = {}): MatchDoc {
  return {
    tournamentId: null,
    home: { name: 'Home', players: [{ playerId: 'h1', name: 'H1' }] },
    away: { name: 'Away', players: [{ playerId: 'a1', name: 'A1' }] },
    squadSize: 11,
    oversLimit: 20,
    ballsPerOver: 6,
    scheduledAt: {} as MatchDoc['scheduledAt'],
    status: 'completed',
    createdBy: 'u1',
    isPublic: false,
    lineup: {
      innings1BattingSide: 'home',
      homeXI: ['h1'],
      awayXI: ['a1'],
      strikerId: 'h1',
      nonStrikerId: 'a1',
      bowlerId: 'a1',
      homeCaptainId: 'hc',
      awayCaptainId: 'ac',
    },
    ...overrides,
  }
}

const state = { winner: 'home' } as ReplayState

describe('resolveMatchWinnerForStats', () => {
  it('uses replay winner when no points outcome', () => {
    expect(resolveMatchWinnerForStats({ winner: 'away' } as ReplayState)).toBe('away')
  })

  it('prefers forced points outcome', () => {
    expect(resolveMatchWinnerForStats(state, 'away_win')).toBe('away')
    expect(resolveMatchWinnerForStats(state, 'tie')).toBe('tie')
  })
})

describe('captaincyIncrementsForPlayer', () => {
  it('returns null when player is not captain', () => {
    expect(captaincyIncrementsForPlayer(baseMatch(), 'x', 'home')).toBeNull()
  })

  it('counts win for winning captain', () => {
    expect(captaincyIncrementsForPlayer(baseMatch(), 'hc', 'home')).toEqual({
      matches: 1,
      wins: 1,
      losses: 0,
      ties: 0,
    })
    expect(captaincyIncrementsForPlayer(baseMatch(), 'ac', 'home')).toEqual({
      matches: 1,
      wins: 0,
      losses: 1,
      ties: 0,
    })
  })

  it('counts tie for both captains', () => {
    expect(captaincyIncrementsForPlayer(baseMatch(), 'hc', 'tie')).toMatchObject({ ties: 1, wins: 0, losses: 0 })
    expect(captaincyIncrementsForPlayer(baseMatch(), 'ac', 'tie')).toMatchObject({ ties: 1 })
  })
})
