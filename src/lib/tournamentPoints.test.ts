import { describe, expect, it } from 'vitest'
import { tournamentLeaguePoints, TOURNAMENT_PTS_PER_TIE_OR_NR, TOURNAMENT_PTS_PER_WIN } from './tournamentPoints'

describe('tournamentLeaguePoints', () => {
  it('is 2 per win, 1 per tie, 1 per no-result in all cases', () => {
    expect(TOURNAMENT_PTS_PER_WIN).toBe(2)
    expect(TOURNAMENT_PTS_PER_TIE_OR_NR).toBe(1)
    expect(tournamentLeaguePoints(0, 0, 0)).toBe(0)
    expect(tournamentLeaguePoints(3, 0, 0)).toBe(6)
    expect(tournamentLeaguePoints(0, 2, 0)).toBe(2)
    expect(tournamentLeaguePoints(0, 0, 2)).toBe(2)
    expect(tournamentLeaguePoints(1, 1, 1)).toBe(2 + 1 + 1)
  })
})
