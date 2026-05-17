import type { Timestamp } from 'firebase/firestore'
import { humanizeResultForMatch } from './humanizeResultText'
import { currentInnings, isInningsOver, opp, type ReplayConfig, type ReplayState } from '../scoring/engine'
import type { MatchDoc } from '../types/models'

export function teamAbbrevFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const w = parts[0] ?? '?'
  return w.length <= 4 ? w.toUpperCase() : w.slice(0, 4).toUpperCase()
}

/** Footer line for compact public listing cards (live, not complete). */
export function buildListingLiveFooter(
  cfg: ReplayConfig,
  state: ReplayState,
  homeName: string,
  awayName: string,
): string | null {
  if (state.matchComplete) return null
  const liveInn = currentInnings(state)
  if (liveInn.innings === 2) {
    const target = state.innings1.runs + 1
    const runsReq = Math.max(0, target - liveInn.runs)
    const cap = cfg.oversLimit * cfg.ballsPerOver
    const ballsLeft = Math.max(0, cap - liveInn.legalBalls)
    const bat = (liveInn.battingSide === 'home' ? homeName : awayName).trim()
    if (runsReq === 0) return `${bat} wins.`
    return `${bat} need ${runsReq} ${runsReq === 1 ? 'run' : 'runs'} from ${ballsLeft} ${ballsLeft === 1 ? 'ball' : 'balls'}.`
  }

  const i1 = state.innings1
  if (!isInningsOver(cfg, i1, state)) {
    // Listing rows already show runs/wickets and overs for innings 1 — avoid duplicating in the footer.
    return null
  }

  const chase = i1.runs + 1
  const chaser = opp(i1.battingSide)
  const chaserShort = teamAbbrevFromName(chaser === 'home' ? homeName : awayName)
  return `${chaserShort} need ${chase} runs to win`
}

/**
 * One-line match status for tournament listing cards: chase (2nd innings live only) or final result.
 */
export function buildTournamentMatchStatsLine(
  match: Pick<MatchDoc, 'status' | 'home' | 'away' | 'resultSummary'>,
  cfg: ReplayConfig,
  state: ReplayState,
): string | null {
  if (state.matchComplete || match.status === 'completed' || match.status === 'abandoned') {
    const raw = (state.resultText ?? match.resultSummary?.text ?? '').trim()
    if (!raw) return null
    return humanizeResultForMatch(raw, match as MatchDoc)
  }

  if (match.status !== 'live' || state.matchComplete) return null

  const liveInn = currentInnings(state)
  if (liveInn.innings !== 2) return null

  const target = state.innings1.runs + 1
  const runsReq = Math.max(0, target - liveInn.runs)
  const cap = cfg.oversLimit * cfg.ballsPerOver
  const ballsLeft = Math.max(0, cap - liveInn.legalBalls)
  const bat = (liveInn.battingSide === 'home' ? match.home.name : match.away.name).trim()
  if (runsReq === 0) return `${bat} wins`
  if (ballsLeft > 0) {
    return `${bat} need ${runsReq} ${runsReq === 1 ? 'run' : 'runs'} from ${ballsLeft} ${ballsLeft === 1 ? 'ball' : 'balls'}`
  }
  return `${bat} need ${runsReq} ${runsReq === 1 ? 'run' : 'runs'}`
}

export function formatMatchListingSchedule(ts: Timestamp | undefined): { dayLine: string; timeLine: string } {
  if (!ts || typeof ts.toDate !== 'function') return { dayLine: '', timeLine: '' }
  const d = ts.toDate()
  const now = new Date()
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((dayStart(d) - dayStart(now)) / (24 * 60 * 60 * 1000))
  let dayLine: string
  if (diffDays === 0) dayLine = 'Today'
  else if (diffDays === 1) dayLine = 'Tomorrow'
  else {
    dayLine = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  }
  const timeLine = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return { dayLine, timeLine }
}
