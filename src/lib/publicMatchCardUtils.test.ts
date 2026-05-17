import { describe, expect, it } from 'vitest'
import type { InningsSnapshot, ReplayConfig, ReplayState } from '../scoring/engine'
import { buildTournamentMatchStatsLine } from './publicMatchCardUtils'
import type { MatchDoc } from '../types/models'

const baseMatch = (): Pick<MatchDoc, 'status' | 'home' | 'away' | 'resultSummary'> => ({
  status: 'live',
  home: { name: 'Mumbai', players: [] },
  away: { name: 'Chennai', players: [] },
  resultSummary: undefined,
})

const cfg: ReplayConfig = {
  squadSize: 11,
  oversLimit: 20,
  ballsPerOver: 6,
  oversPerBowler: 4,
  lineup: {
    innings1BattingSide: 'home',
    homeXI: [],
    awayXI: [],
    strikerId: '',
    nonStrikerId: '',
    bowlerId: '',
  },
  homeName: 'Mumbai',
  awayName: 'Chennai',
}

function innings(
  partial: Pick<InningsSnapshot, 'innings' | 'battingSide' | 'runs' | 'wickets' | 'legalBalls'> &
    Partial<InningsSnapshot>,
): InningsSnapshot {
  return {
    strikerId: '',
    nonStrikerId: '',
    bowlerId: '',
    dismissed: new Set(),
    appearedBatIds: new Set(),
    retiredOffField: new Set(),
    bowlerBallCounts: {},
    bowlerConfirmedAtLegalCount: 0,
    ...partial,
  }
}

function chaseState(overrides: Partial<ReplayState> = {}): ReplayState {
  return {
    activeInnings: 2,
    innings1: innings({
      innings: 1,
      battingSide: 'home',
      runs: 150,
      wickets: 5,
      legalBalls: 120,
    }),
    innings2: innings({
      innings: 2,
      battingSide: 'away',
      runs: 118,
      wickets: 4,
      legalBalls: 108,
    }),
    manualEndInnings1: null,
    manualEndInnings2: null,
    matchComplete: false,
    winner: null,
    resultText: null,
    recentBalls: [],
    batterStats: {},
    bowlerStats: {},
    ...overrides,
  }
}

describe('buildTournamentMatchStatsLine', () => {
  it('shows second-innings chase for live matches', () => {
    const line = buildTournamentMatchStatsLine(baseMatch(), cfg, chaseState())
    expect(line).toBe('Chennai need 33 runs from 12 balls')
  })

  it('shows humanized result when match is complete', () => {
    const match = { ...baseMatch(), status: 'completed' as const }
    const state = chaseState({
      matchComplete: true,
      winner: 'away',
      resultText: 'away won by 3 wickets',
    })
    expect(buildTournamentMatchStatsLine(match, cfg, state)).toBe('Chennai won by 3 wickets')
  })

  it('returns null during first innings', () => {
    const state = chaseState({
      activeInnings: 1,
      innings2: undefined,
    })
    expect(buildTournamentMatchStatsLine(baseMatch(), cfg, state)).toBeNull()
  })
})
