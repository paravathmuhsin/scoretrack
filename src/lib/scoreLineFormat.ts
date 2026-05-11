import {
  oversLimitDisplay,
  oversProgressString,
  oversString,
  type ReplayConfig,
  type ReplayState,
} from '../scoring/engine'
import type { Side } from '../types/models'

export type ScoreLineParts =
  | { kind: 'yet'; text: string }
  | { kind: 'innings'; rw: string; overs: string | null }

/**
 * Parenthesized overs for live summary, or null when progress matches the cap
 * (e.g. 12/12) and is non-zero — nothing extra to show vs the limit.
 */
export function inningsOversSummaryParen(
  legalBalls: number,
  ballsPerOver: number,
  oversLimit: number,
): string | null {
  const cur = oversString(legalBalls, ballsPerOver)
  const cap = oversLimitDisplay(oversLimit)
  if (cur === cap && cur !== '0') return null
  return `(${oversProgressString(legalBalls, ballsPerOver, oversLimit)})`
}

/** Runs/wickets and overs separately for live summary (emphasis on `rw` only). */
export function scoreLinePartsForSide(
  state: ReplayState,
  cfg: ReplayConfig,
  side: Side,
): ScoreLineParts {
  if (state.innings1.battingSide === side) {
    const inn = state.innings1
    return {
      kind: 'innings',
      rw: `${inn.runs} - ${inn.wickets}`,
      overs: inningsOversSummaryParen(inn.legalBalls, cfg.ballsPerOver, cfg.oversLimit),
    }
  }
  if (state.innings2?.battingSide === side) {
    const inn = state.innings2
    return {
      kind: 'innings',
      rw: `${inn.runs} - ${inn.wickets}`,
      overs: inningsOversSummaryParen(inn.legalBalls, cfg.ballsPerOver, cfg.oversLimit),
    }
  }
  return { kind: 'yet', text: 'Yet to bat' }
}

/** Runs/wickets plus overs progress (e.g. `12 - 2 (4.3/20)`). */
export function scoreLineForSide(state: ReplayState, cfg: ReplayConfig, side: Side): string {
  const p = scoreLinePartsForSide(state, cfg, side)
  if (p.kind === 'yet') return p.text
  return p.overs ? `${p.rw} ${p.overs}` : p.rw
}

/** One row of the public match / tournament card (split so UI can style overs smaller). */
export type MatchCardRowParts = {
  statusOnly: string | null
  /** Runs–wickets, e.g. `1 - 0`; null when not yet batting. */
  rw: string | null
  /** Parenthesized overs from `inningsOversSummaryParen`, e.g. `(0.1/10)`; null when omitted at cap. */
  oversParen: string | null
}

/**
 * Same overs rules as the score page (`inningsOversSummaryParen`). No chase target on listings.
 */
export function matchCardRowContent(
  state: ReplayState,
  cfg: ReplayConfig,
  side: Side,
): MatchCardRowParts {
  const parts = scoreLinePartsForSide(state, cfg, side)
  if (parts.kind === 'yet') {
    return { rw: null, oversParen: null, statusOnly: state.matchComplete ? null : 'Yet to bat' }
  }
  return { rw: parts.rw, oversParen: parts.overs, statusOnly: null }
}
