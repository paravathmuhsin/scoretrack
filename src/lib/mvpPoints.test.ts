import { describe, expect, it } from 'vitest'
import {
  calculateEconomy,
  calculateStrikeRate,
  computeMvpPointsForPlayer,
  getEconomyBonus,
  getStrikeRateBonus,
  type MvpMatchContext,
  type MvpPlayerStats,
} from './mvpPoints'

const emptyCtx = (): MvpMatchContext => ({ winningTeamId: '', topScorerPlayerId: '' })

function baseStats(overrides: Partial<MvpPlayerStats> = {}): MvpPlayerStats {
  return {
    playerId: 'p1',
    teamId: 't1',
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    wickets: 0,
    maidenOvers: 0,
    oversBowled: 0,
    runsConceded: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
    ducks: false,
    dismissalTypes: [],
    ...overrides,
  }
}

describe('calculateStrikeRate', () => {
  it('returns 0 when no balls faced', () => {
    expect(calculateStrikeRate(40, 0)).toBe(0)
  })
  it('computes SR', () => {
    expect(calculateStrikeRate(30, 20)).toBe(150)
  })
})

describe('calculateEconomy', () => {
  it('returns 0 when no overs', () => {
    expect(calculateEconomy(12, 0)).toBe(0)
  })
  it('computes economy', () => {
    expect(calculateEconomy(12, 2)).toBe(6)
  })
})

describe('getStrikeRateBonus', () => {
  it('requires 10+ balls', () => {
    expect(getStrikeRateBonus(30, 9)).toBe(0)
    expect(getStrikeRateBonus(12, 10)).toBe(5) // SR 120
  })
  it('uses top bracket', () => {
    expect(getStrikeRateBonus(36, 10)).toBe(20) // 180+
  })
})

describe('getEconomyBonus', () => {
  it('requires 2+ overs', () => {
    expect(getEconomyBonus(4, 1.9)).toBe(0)
    expect(getEconomyBonus(7.9, 2)).toBe(5)
  })
  it('best economy tier only', () => {
    expect(getEconomyBonus(4.5, 3)).toBe(20)
  })
})

describe('computeMvpPointsForPlayer', () => {
  it('sums batting boundaries and milestones (highest tier)', () => {
    const r = computeMvpPointsForPlayer(
      baseStats({ runs: 100, balls: 50, fours: 10, sixes: 2 }),
      emptyCtx(),
    )
    expect(r.batting).toBe(100 + 10 + 4 + getStrikeRateBonus(100, 50) + 40)
    expect(r.total).toBe(r.batting)
  })

  it('applies duck penalty', () => {
    const r = computeMvpPointsForPlayer(baseStats({ ducks: true, runs: 0, balls: 1 }), emptyCtx())
    expect(r.batting).toBe(-5)
  })

  it('ignores duck flag when runs > 0', () => {
    const r = computeMvpPointsForPlayer(baseStats({ ducks: true, runs: 1, balls: 1 }), emptyCtx())
    expect(r.breakdown.duckPenalty).toBeUndefined()
  })

  it('bowling: wickets, maidens, economy, milestones, bowled/lbw', () => {
    const r = computeMvpPointsForPlayer(
      baseStats({
        runs: 0,
        balls: 0,
        wickets: 5,
        dismissalTypes: ['Bowled', 'LBW', 'Catch out', 'Catch out', 'Bowled'],
        maidenOvers: 1,
        oversBowled: 4,
        runsConceded: 18,
      }),
      emptyCtx(),
    )
    const econ = calculateEconomy(18, 4) // 4.5
    expect(r.bowling).toBe(25 * 5 + 8 * 3 + 15 + getEconomyBonus(econ, 4) + 50)
  })

  it('caps bowled/lbw extras at wicket count', () => {
    const r = computeMvpPointsForPlayer(
      baseStats({
        wickets: 1,
        dismissalTypes: ['Bowled', 'LBW', 'Bowled'],
      }),
      emptyCtx(),
    )
    expect(r.breakdown.bowledLbwBonus).toBe(8)
  })

  it('fielding and impact', () => {
    const r = computeMvpPointsForPlayer(
      baseStats({
        teamId: 'win',
        runs: 25,
        balls: 10,
        catches: 1,
        runOuts: 1,
        stumpings: 1,
        dismissedPlayerIds: ['top'],
        matchFinishingInnings: true,
      }),
      { winningTeamId: 'win', topScorerPlayerId: 'top' },
    )
    expect(r.fielding).toBe(8 + 12 + 12)
    expect(r.impact).toBe(15 + 10 + 8 + 15)
  })

  it('is deterministic for NaN-ish inputs', () => {
    const r = computeMvpPointsForPlayer(
      baseStats({
        runs: Number.NaN,
        balls: -3,
        oversBowled: Number.NaN,
      }),
      emptyCtx(),
    )
    expect(r.total).toBe(0)
  })
})
