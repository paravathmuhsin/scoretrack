import { oversString, type ReplayConfig, type ReplayState } from '../scoring/engine'
import { humanizeResultForMatch } from './humanizeResultText'
import type { MatchDoc } from '../types/models'

export function matchCompleteHeadline(state: ReplayState, match: MatchDoc): string {
  return humanizeResultForMatch(state.resultText ?? 'Match complete', match)
}

export function matchCompleteScoreLines(
  state: ReplayState,
  cfg: ReplayConfig,
  match: MatchDoc,
): string[] {
  const i1 = state.innings1
  const firstName = i1.battingSide === 'home' ? match.home.name : match.away.name
  const lines: string[] = [
    `${firstName}: ${i1.runs}/${i1.wickets} (${oversString(i1.legalBalls, cfg.ballsPerOver)} ov)`,
  ]
  if (state.innings2) {
    const i2 = state.innings2
    const secondName = i2.battingSide === 'home' ? match.home.name : match.away.name
    lines.push(`${secondName}: ${i2.runs}/${i2.wickets} (${oversString(i2.legalBalls, cfg.ballsPerOver)} ov)`)
  }
  return lines
}
