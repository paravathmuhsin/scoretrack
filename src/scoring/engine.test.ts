import { describe, expect, it } from 'vitest'
import {
  battersYetToPlayIds,
  formatExtrasBreakdownLine,
  initialReplayState,
  inningsExtrasBreakdownFromBalls,
  inningsOversBallTimeline,
  isInningsOver,
  maxWickets,
  needsNewBowlerBeforeNextBall,
  opp,
  oversLimitDisplay,
  oversProgressString,
  oversString,
  replayEvents,
  runsForStrikeRotation,
  symbolForBall,
  symbolsThisOver,
  totalRunsOnDelivery,
  type ReplayConfig,
  type ScoreEvent,
} from './engine'
import type { BallEventPayload, MatchLineup } from '../types/models'

function lineup(homeBatFirst: boolean): MatchLineup {
  return {
    innings1BattingSide: homeBatFirst ? 'home' : 'away',
    homeXI: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9', 'h10', 'h11'],
    awayXI: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11'],
    strikerId: homeBatFirst ? 'h1' : 'a1',
    nonStrikerId: homeBatFirst ? 'h2' : 'a2',
    bowlerId: homeBatFirst ? 'a1' : 'h1',
  }
}

function cfg(homeBatFirst: boolean, oversPerBowler: number | null = null): ReplayConfig {
  return {
    squadSize: 11,
    oversLimit: 2,
    ballsPerOver: 6,
    oversPerBowler,
    lineup: lineup(homeBatFirst),
  }
}

function ball(
  c: ReplayConfig,
  partial: Partial<BallEventPayload> & Pick<BallEventPayload, 'delivery' | 'runsOffBat'>,
): BallEventPayload {
  const inn = partial.innings ?? 1
  const battingSide =
    partial.battingSide ?? (inn === 1 ? c.lineup.innings1BattingSide : opp(c.lineup.innings1BattingSide))
  const out: BallEventPayload = {
    innings: inn,
    battingSide,
    delivery: partial.delivery,
    runsOffBat: partial.runsOffBat,
    extraWideRuns: partial.extraWideRuns ?? 0,
    extraNoBallRuns: partial.extraNoBallRuns ?? 0,
    byeRuns: partial.byeRuns ?? 0,
    legByeRuns: partial.legByeRuns ?? 0,
    wicket: partial.wicket,
  }
  if (partial.noDelivery) out.noDelivery = true
  return out
}

describe('totalRunsOnDelivery', () => {
  it('counts wide penalty', () => {
    const b = ball(cfg(true), { delivery: 'wide', runsOffBat: 0 })
    expect(totalRunsOnDelivery(b)).toBe(1)
  })
})

describe('runsForStrikeRotation', () => {
  it('excludes wide penalty so plain wide does not contribute to rotation parity', () => {
    const b = ball(cfg(true), { delivery: 'wide', runsOffBat: 0 })
    expect(runsForStrikeRotation(b)).toBe(0)
    expect(totalRunsOnDelivery(b)).toBe(1)
  })

  it('includes extra wide runs and bye/leg-bye on wide', () => {
    const c = cfg(true)
    expect(
      runsForStrikeRotation(ball(c, { delivery: 'wide', runsOffBat: 0, extraWideRuns: 2 })),
    ).toBe(2)
    expect(
      runsForStrikeRotation(
        ball(c, { delivery: 'wide', runsOffBat: 0, byeRuns: 1 }),
      ),
    ).toBe(1)
  })

  it('excludes no-ball penalty', () => {
    const b = ball(cfg(true), { delivery: 'noball', runsOffBat: 0 })
    expect(runsForStrikeRotation(b)).toBe(0)
    expect(totalRunsOnDelivery(b)).toBe(1)
  })

  it('matches legal delivery total (byes / leg-byes)', () => {
    const c = cfg(true)
    expect(runsForStrikeRotation(ball(c, { delivery: 'legal', runsOffBat: 0, byeRuns: 3 }))).toBe(
      3,
    )
    expect(runsForStrikeRotation(ball(c, { delivery: 'legal', runsOffBat: 1, byeRuns: 1 }))).toBe(
      2,
    )
  })
})

describe('strike rotation on extras', () => {
  it('does not swap ends on a plain wide (penalty only)', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'wide', runsOffBat: 0 }) },
    ]
    const s = replayEvents(c, events)
    expect(s.innings1.runs).toBe(1)
    expect(s.innings1.strikerId).toBe('h1')
    expect(s.innings1.nonStrikerId).toBe('h2')
  })

  it('swaps ends when wide has additional runs', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'wide', runsOffBat: 0, extraWideRuns: 1 }) },
    ]
    const s = replayEvents(c, events)
    expect(s.innings1.runs).toBe(2)
    expect(s.innings1.strikerId).toBe('h2')
  })

  it('does not swap on plain no-ball', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'noball', runsOffBat: 0 }) },
    ]
    const s = replayEvents(c, events)
    expect(s.innings1.runs).toBe(1)
    expect(s.innings1.strikerId).toBe('h1')
  })

  it('still rotates on legal bye runs only', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 0, byeRuns: 1 }) },
    ]
    const s = replayEvents(c, events)
    expect(s.innings1.strikerId).toBe('h2')
  })
})

describe('wicket on last ball of over', () => {
  it('swaps ends so former non-striker faces after striker out on 6th legal ball', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = []
    let seq = 1
    for (let i = 0; i < 5; i++) {
      events.push({ seq: seq++, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 0 }) })
    }
    events.push({
      seq: seq++,
      kind: 'ball',
      ball: {
        ...ball(c, { delivery: 'legal', runsOffBat: 0 }),
        wicket: { dismissedId: 'h1', howOut: 'Bowled', newBatsmanId: 'h3' },
      },
    })
    const s = replayEvents(c, events)
    expect(s.innings1.legalBalls).toBe(6)
    expect(s.innings1.strikerId).toBe('h2')
    expect(s.innings1.nonStrikerId).toBe('h3')
  })

  it('swaps ends after non-striker out on 6th legal ball', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = []
    let seq = 1
    for (let i = 0; i < 5; i++) {
      events.push({ seq: seq++, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 0 }) })
    }
    events.push({
      seq: seq++,
      kind: 'ball',
      ball: {
        ...ball(c, { delivery: 'legal', runsOffBat: 0 }),
        wicket: { dismissedId: 'h2', howOut: 'Run out', newBatsmanId: 'h3' },
      },
    })
    const s = replayEvents(c, events)
    expect(s.innings1.legalBalls).toBe(6)
    expect(s.innings1.strikerId).toBe('h3')
    expect(s.innings1.nonStrikerId).toBe('h1')
  })
})

describe('inningsExtrasBreakdownFromBalls', () => {
  it('aggregates wides and no-balls into breakdown labels', () => {
    const c = cfg(true)
    const side = c.lineup.innings1BattingSide
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'wide', runsOffBat: 0 }) },
      { seq: 2, kind: 'ball', ball: ball(c, { delivery: 'noball', runsOffBat: 0 }) },
    ]
    const x = inningsExtrasBreakdownFromBalls(events, 1, side)
    expect(x.wd).toBe(1)
    expect(x.nb).toBe(1)
    expect(formatExtrasBreakdownLine(2, x, 0)).toBe('2 (1wd, 1nb)')
  })

  it('ignores undone balls', () => {
    const c = cfg(true)
    const side = c.lineup.innings1BattingSide
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'wide', runsOffBat: 0 }) },
      { seq: 2, kind: 'undo', revertedSeq: 1 },
    ]
    const x = inningsExtrasBreakdownFromBalls(events, 1, side)
    expect(x.wd).toBe(0)
  })
})

describe('replayEvents', () => {
  it('scores a legal single and rotates strike', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 1 }) },
    ]
    const s = replayEvents(c, events)
    expect(s.innings1.runs).toBe(1)
    expect(s.innings1.strikerId).toBe('h2')
    expect(s.innings1.nonStrikerId).toBe('h1')
  })

  it('respects undo', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 4 }) },
      { seq: 2, kind: 'undo', revertedSeq: 1 },
    ]
    const s = replayEvents(c, events)
    expect(s.innings1.runs).toBe(0)
  })

  it('clears “needs next bowler” after change_bowler at over end (overs-per-bowler)', () => {
    const c = cfg(true, 2)
    const events: ScoreEvent[] = []
    for (let i = 1; i <= 6; i++) {
      events.push({ seq: i, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 0 }) })
    }
    let s = replayEvents(c, events)
    expect(needsNewBowlerBeforeNextBall(c, s)).toBe(true)
    events.push({ seq: 7, kind: 'change_bowler', bowlerId: 'a2' })
    s = replayEvents(c, events)
    expect(needsNewBowlerBeforeNextBall(c, s)).toBe(false)
  })

  it('undo after change_bowler restores “needs next bowler” and prior bowler', () => {
    const c = cfg(true, 2)
    const events: ScoreEvent[] = []
    for (let i = 1; i <= 6; i++) {
      events.push({ seq: i, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 0 }) })
    }
    events.push({ seq: 7, kind: 'change_bowler', bowlerId: 'a2' })
    events.push({ seq: 8, kind: 'undo', revertedSeq: 7 })
    const s = replayEvents(c, events)
    expect(needsNewBowlerBeforeNextBall(c, s)).toBe(true)
    expect(s.innings1.bowlerId).toBe('a1')
  })

  it('ends first innings on declared without a final wicket', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 1 }) },
      { seq: 2, kind: 'end_innings', innings: 1, reason: 'declared' },
    ]
    const s = replayEvents(c, events)
    expect(isInningsOver(c, s.innings1, s)).toBe(true)
    expect(s.innings2).toBe(null)
    expect(s.matchComplete).toBe(false)
    expect(s.manualEndInnings1).toBe('declared')
  })

  it('undo after manual end_innings clears first-innings closure', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 1 }) },
      { seq: 2, kind: 'end_innings', innings: 1, reason: 'declared' },
      { seq: 3, kind: 'undo', revertedSeq: 2 },
    ]
    const s = replayEvents(c, events)
    expect(s.manualEndInnings1).toBe(null)
    expect(isInningsOver(c, s.innings1, s)).toBe(false)
  })

  it('completes chase', () => {
    const c = cfg(true)
    const bat2 = opp(c.lineup.innings1BattingSide)
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 6 }) },
      {
        seq: 2,
        kind: 'start_second_innings',
        battingSide: bat2,
        strikerId: bat2 === 'home' ? 'h1' : 'a1',
        nonStrikerId: bat2 === 'home' ? 'h2' : 'a2',
        bowlerId: bat2 === 'home' ? 'a1' : 'h3',
      },
      {
        seq: 3,
        kind: 'ball',
        ball: { ...ball(c, { delivery: 'legal', runsOffBat: 6 }), innings: 2, battingSide: bat2 },
      },
      {
        seq: 4,
        kind: 'ball',
        ball: { ...ball(c, { delivery: 'legal', runsOffBat: 1 }), innings: 2, battingSide: bat2 },
      },
    ]
    const s = replayEvents(c, events)
    expect(s.matchComplete).toBe(true)
    expect(s.winner).toBe(bat2)
  })
})

describe('overthrow', () => {
  it('adds runs without a delivery', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 1 }) },
      { seq: 2, kind: 'overthrow', runs: 4 },
    ]
    const s = replayEvents(c, events)
    expect(s.innings1.runs).toBe(5)
    expect(s.innings1.legalBalls).toBe(1)
    expect(s.recentBalls.some((x) => x === '+4')).toBe(true)
  })
})

describe('symbolForBall', () => {
  it('shows wide with wicket', () => {
    const c = cfg(true)
    const b = ball(c, {
      delivery: 'wide',
      runsOffBat: 0,
      extraWideRuns: 2,
      wicket: { dismissedId: 'h1', howOut: 'Stumped' },
    })
    expect(symbolForBall(b)).toBe('Wd2W')
  })

  it('shows wide extra runs as Wd1 for one bonus run', () => {
    const c = cfg(true)
    const b = ball(c, { delivery: 'wide', runsOffBat: 0, extraWideRuns: 1 })
    expect(symbolForBall(b)).toBe('Wd1')
    expect(totalRunsOnDelivery(b)).toBe(2)
  })

  it('shows noball extra runs', () => {
    const c = cfg(true)
    const b = ball(c, { delivery: 'noball', runsOffBat: 0, extraNoBallRuns: 1 })
    expect(symbolForBall(b)).toBe('Nb1')
    expect(totalRunsOnDelivery(b)).toBe(2)
  })

  it('shows legal wicket with runs scored on the same delivery (e.g. run out + 1)', () => {
    const c = cfg(true)
    const b = ball(c, {
      delivery: 'legal',
      runsOffBat: 0,
      byeRuns: 1,
      wicket: { dismissedId: 'h1', howOut: 'Run out', newBatsmanId: 'h3' },
    })
    expect(symbolForBall(b)).toBe('1W')
  })

  it('shows plain W for legal wicket with zero runs on the ball', () => {
    const c = cfg(true)
    const b = ball(c, {
      delivery: 'legal',
      runsOffBat: 0,
      wicket: { dismissedId: 'h1', howOut: 'Bowled', newBatsmanId: 'h3' },
    })
    expect(symbolForBall(b)).toBe('W')
  })
})

describe('retired hurt', () => {
  it('does not count as wicket or legal ball; marks Rh; batter may return later', () => {
    const c = cfg(true)
    const b: BallEventPayload = {
      ...ball(c, {
        delivery: 'legal',
        runsOffBat: 0,
        noDelivery: true,
        wicket: {
          dismissedId: 'h1',
          howOut: 'Retired hurt',
          newBatsmanId: 'h3',
          countsAsWicket: false,
        },
      }),
    }
    const events: ScoreEvent[] = [{ seq: 1, kind: 'ball', ball: b }]
    const s = replayEvents(c, events)
    expect(s.innings1.wickets).toBe(0)
    expect(s.innings1.legalBalls).toBe(0)
    expect(s.innings1.strikerId).toBe('h3')
    expect(s.innings1.nonStrikerId).toBe('h2')
    expect(s.innings1.dismissed.has('h1')).toBe(false)
    expect(s.innings1.retiredOffField.has('h1')).toBe(true)
    expect(s.batterStats.h1?.out).toBe(false)
    expect(symbolForBall(b)).toBe('Rh')
    expect(s.recentBalls.includes('Rh')).toBe(false)
  })

  it('when a retired hurt batter returns as new batsman, clears retired flag and keeps prior runs', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 4 }) },
      {
        seq: 2,
        kind: 'ball',
        ball: ball(c, {
          delivery: 'legal',
          runsOffBat: 0,
          noDelivery: true,
          wicket: {
            dismissedId: 'h1',
            howOut: 'Retired hurt',
            newBatsmanId: 'h3',
            countsAsWicket: false,
          },
        }),
      },
      {
        seq: 3,
        kind: 'ball',
        ball: ball(c, {
          delivery: 'legal',
          runsOffBat: 0,
          wicket: { dismissedId: 'h2', howOut: 'Bowled', newBatsmanId: 'h1' },
        }),
      },
    ]
    const s = replayEvents(c, events)
    expect(s.innings1.retiredOffField.has('h1')).toBe(false)
    expect(s.batterStats.h1?.how).toBeUndefined()
    expect(s.batterStats.h1?.runs).toBe(4)
    expect(s.innings1.nonStrikerId).toBe('h1')
  })
})

describe('battersYetToPlayIds', () => {
  it('includes retired hurt players who may return as incoming batsman', () => {
    const c = cfg(true)
    const rh: BallEventPayload = ball(c, {
      delivery: 'legal',
      runsOffBat: 0,
      noDelivery: true,
      wicket: {
        dismissedId: 'h1',
        howOut: 'Retired hurt',
        newBatsmanId: 'h3',
        countsAsWicket: false,
      },
    })
    const s = replayEvents(c, [{ seq: 1, kind: 'ball', ball: rh }])
    const inn = s.innings1
    const xi = c.lineup.homeXI
    // h2 dismissed: partner is h3 (striker); h1 is retired hurt and should be pickable
    expect(battersYetToPlayIds(xi, inn, 'h2')).toContain('h1')
    expect(battersYetToPlayIds(xi, inn, 'h2')).toContain('h4')
    expect(battersYetToPlayIds(xi, inn, 'h2')).not.toContain('h2')
    expect(battersYetToPlayIds(xi, inn, 'h2')).not.toContain('h3')
  })
})

describe('swap_ends', () => {
  it('swaps striker and non-striker without counting a ball', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 1 }) },
      { seq: 2, kind: 'swap_ends' },
    ]
    const s = replayEvents(c, events)
    expect(s.innings1.strikerId).toBe('h1')
    expect(s.innings1.nonStrikerId).toBe('h2')
    expect(s.innings1.legalBalls).toBe(1)
    expect(s.recentBalls.includes('⇄')).toBe(false)
  })
})

describe('symbolsThisOver', () => {
  it('shows only balls in the current partial over', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = [
      { seq: 1, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 1 }) },
      { seq: 2, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 4 }) },
    ]
    expect(symbolsThisOver(c, events)).toEqual(['1', '4'])
  })

  it('clears after a full over of legal balls', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = []
    for (let i = 1; i <= 6; i++) {
      events.push({ seq: i, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 0 }) })
    }
    expect(symbolsThisOver(c, events)).toEqual([])
  })

  it('starts fresh after the sixth legal then new deliveries', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = []
    for (let i = 1; i <= 6; i++) {
      events.push({ seq: i, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 0 }) })
    }
    events.push({ seq: 7, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 2 }) })
    expect(symbolsThisOver(c, events)).toEqual(['2'])
  })
})

describe('inningsOversBallTimeline', () => {
  it('groups six legal balls into one completed over with run sum', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = []
    let seq = 1
    for (const r of [1, 2, 0, 0, 0, 3]) {
      events.push({ seq: seq++, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: r }) })
    }
    const t = inningsOversBallTimeline(c, events, 1, 'home')
    expect(t.completed).toHaveLength(1)
    expect(t.completed[0]!.overNumber).toBe(1)
    expect(t.completed[0]!.symbols).toEqual(['1', '2', '0', '0', '0', '3'])
    expect(t.completed[0]!.runsInOver).toBe(6)
    expect(t.partial).toBe(null)
  })

  it('keeps partial over after five legal balls', () => {
    const c = cfg(true)
    const events: ScoreEvent[] = []
    for (let i = 1; i <= 5; i++) {
      events.push({ seq: i, kind: 'ball', ball: ball(c, { delivery: 'legal', runsOffBat: 1 }) })
    }
    const t = inningsOversBallTimeline(c, events, 1, 'home')
    expect(t.completed).toHaveLength(0)
    expect(t.partial?.symbols).toHaveLength(5)
    expect(t.partial?.runsInOver).toBe(5)
  })
})

describe('maxWickets', () => {
  it('is squad minus one', () => {
    expect(maxWickets(11)).toBe(10)
  })
})

describe('initialReplayState', () => {
  it('seeds openers', () => {
    const c = cfg(true)
    const s = initialReplayState(c)
    expect(s.innings1.strikerId).toBe('h1')
  })
})

describe('overs display', () => {
  it('oversString omits .0 for complete overs', () => {
    expect(oversString(12, 6)).toBe('2')
    expect(oversString(0, 6)).toBe('0')
    expect(oversString(15, 6)).toBe('2.3')
  })

  it('oversProgressString combines current and cap', () => {
    expect(oversProgressString(12, 6, 2)).toBe('2/2')
    expect(oversProgressString(15, 6, 20)).toBe('2.3/20')
  })

  it('oversLimitDisplay normalizes near-integer floats', () => {
    expect(oversLimitDisplay(20)).toBe('20')
    expect(oversLimitDisplay(19.9999995)).toBe('20')
  })
})
