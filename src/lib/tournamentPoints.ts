/**
 * Tournament league points table — single rule for every match type (natural finish,
 * organiser-declared result, abandoned no-result). Aggregates store wins, ties, and
 * no-results per team; this function turns those counts into points.
 */

export const TOURNAMENT_PTS_PER_WIN = 2
export const TOURNAMENT_PTS_PER_TIE_OR_NR = 1

/** Win → 2 pts each; tie or no-result → 1 pt each (per occurrence). */
export function tournamentLeaguePoints(won: number, tied: number, nr: number): number {
  return won * TOURNAMENT_PTS_PER_WIN + tied * TOURNAMENT_PTS_PER_TIE_OR_NR + nr * TOURNAMENT_PTS_PER_TIE_OR_NR
}
