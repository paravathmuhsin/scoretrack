import {
  isInningsOver,
  needsNewBowlerBeforeNextBall,
  type ReplayConfig,
  type ReplayState,
} from '../scoring/engine'
import type { MatchDoc } from '../types/models'

/** Default preview duration when `overlayPrefs.previewDurationSec` is missing. */
export const DEFAULT_OVERLAY_PREVIEW_DURATION_SEC = 5

/** Large panel primary: `none` = score bar only. */
export type OverlayEffectivePrimary = 'none' | 'batting' | 'bowling' | 'summary'

/**
 * Same rules as {@link ScoreMatchPage} modals: match summary, first-innings break (bowling card),
 * between-overs bowler confirm (batting card), else score bar only.
 */
export function resolveAutomatedOverlayPrimary(
  match: Pick<MatchDoc, 'status'>,
  cfg: ReplayConfig,
  state: ReplayState,
): OverlayEffectivePrimary {
  if (state.matchComplete) return 'summary'
  if (
    match.status === 'live' &&
    !state.innings2 &&
    isInningsOver(cfg, state.innings1, state)
  ) {
    return 'bowling'
  }
  if (match.status === 'live' && needsNewBowlerBeforeNextBall(cfg, state)) {
    return 'batting'
  }
  return 'none'
}

export function overlayPreviewUntilMs(match: MatchDoc, nowMs: number): number | null {
  const p = match.overlayPreview
  if (!p?.until) return null
  const t = typeof p.until.toMillis === 'function' ? p.until.toMillis() : 0
  return t > nowMs ? t : null
}

/**
 * Firestore timed preview overrides automation when `overlayPreview.until` is in the future.
 */
export function resolveEffectiveOverlayPrimary(
  match: MatchDoc,
  cfg: ReplayConfig | null,
  state: ReplayState | null,
  nowMs: number,
): OverlayEffectivePrimary {
  const until = overlayPreviewUntilMs(match, nowMs)
  if (until != null) {
    const primary = match.overlayPreview?.primary
    if (primary === 'scoreBarOnly') return 'none'
    if (primary === 'batting') return 'batting'
    if (primary === 'bowling') return 'bowling'
    if (primary === 'summary') return 'summary'
  }
  if (!cfg || !state) return 'none'
  return resolveAutomatedOverlayPrimary(match, cfg, state)
}

export function overlayPreviewDurationSec(match: MatchDoc): number {
  const n = match.overlayPrefs?.previewDurationSec
  if (typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 120) return Math.floor(n)
  return DEFAULT_OVERLAY_PREVIEW_DURATION_SEC
}
