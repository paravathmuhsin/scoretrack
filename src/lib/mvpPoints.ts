/**
 * Match MVP (fantasy-style) points from per-player aggregate stats.
 * All functions are pure: no I/O, same inputs → same outputs.
 */

/** Per-player box-style numbers for one match (bat + bowl + field + flags). */
export type MvpPlayerStats = {
  playerId: string
  runs: number
  balls: number
  fours: number
  sixes: number
  wickets: number
  maidenOvers: number
  oversBowled: number
  runsConceded: number
  catches: number
  stumpings: number
  runOuts: number
  ducks: boolean
  /** How each wicket to this bowler was taken (Bowled / LBW / …). */
  dismissalTypes: string[]
  /** Batter IDs dismissed by this bowler; used for “wicket of top scorer”. */
  dismissedPlayerIds?: string[]
  teamId: string
  notOut?: boolean
  /** Set true when this player’s innings closed the chase or defence (caller supplies). */
  matchFinishingInnings?: boolean
}

export type MvpMatchContext = {
  winningTeamId: string
  topScorerPlayerId: string
}

/** Point components returned to callers / UI. Optional fields are omitted when zero. */
export type MvpScoreBreakdown = {
  runs?: number
  fours?: number
  sixes?: number
  strikeRateBonus?: number
  /** Highest applicable 30/50/75/100 tier (one bonus only). */
  battingMilestones?: number
  /** Negative when a duck penalty applies. */
  duckPenalty?: number
  /** Base: 25 points per wicket. */
  wickets?: number
  /** +8 per Bowled or LBW dismissal credited to this bowler. */
  bowledLbwBonus?: number
  /** +15 per maiden over. */
  maidens?: number
  economyBonus?: number
  /** Highest 2/3/4/5 wicket tier (one bonus only). */
  wicketMilestoneBonus?: number
  catches?: number
  runOuts?: number
  stumpings?: number
  /** Sum of all impact bonuses (win, cameo, top-scorer wicket, finisher). */
  impactBonus?: number
}

export type MvpPointsResult = {
  total: number
  batting: number
  bowling: number
  fielding: number
  impact: number
  breakdown: MvpScoreBreakdown
}

const MIN_BALLS_FOR_SR_BONUS = 10
const MIN_OVERS_FOR_ECONOMY_BONUS = 2

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function normalizeDismissalKind(how: string): string {
  return how.trim().toLowerCase()
}

/** True for bowler-credited bowled or leg-before dismissals (case-insensitive). */
export function isBowledOrLbwDismissal(how: string): boolean {
  const k = normalizeDismissalKind(how)
  return k === 'bowled' || k === 'lbw'
}

/**
 * Strike rate = runs per 100 balls. Returns 0 if balls <= 0 or inputs non-finite.
 */
export function calculateStrikeRate(runs: number, ballsFaced: number): number {
  const r = clampNonNeg(runs)
  const b = clampNonNeg(ballsFaced)
  if (b <= 0) return 0
  return (r / b) * 100
}

/**
 * Economy = runs conceded per over. Returns 0 if oversBowled <= 0 or inputs non-finite.
 */
export function calculateEconomy(runsConceded: number, oversBowled: number): number {
  const rc = clampNonNeg(runsConceded)
  const o = clampNonNeg(oversBowled)
  if (o <= 0) return 0
  return rc / o
}

/**
 * SR bonus brackets (only if balls faced ≥ 10): 120–139 → +5, 140–159 → +10, 160–179 → +15, 180+ → +20.
 * Upper brackets win (180+ includes all higher values).
 */
export function getStrikeRateBonus(runs: number, ballsFaced: number): number {
  const b = clampNonNeg(ballsFaced)
  if (b < MIN_BALLS_FOR_SR_BONUS) return 0
  const sr = calculateStrikeRate(runs, b)
  if (sr >= 180) return 20
  if (sr >= 160) return 15
  if (sr >= 140) return 10
  if (sr >= 120) return 5
  return 0
}

/**
 * Economy bonus (only if overs bowled ≥ 2): <8 → +5, <6 → +10, <5 → +20 (best tier only).
 */
export function getEconomyBonus(economy: number, oversBowled: number): number {
  const o = clampNonNeg(oversBowled)
  if (o + 1e-9 < MIN_OVERS_FOR_ECONOMY_BONUS) return 0
  if (!Number.isFinite(economy) || economy < 0) return 0
  if (economy < 5) return 20
  if (economy < 6) return 10
  if (economy < 8) return 5
  return 0
}

/** Single highest milestone bonus for batting runs. */
export function getBattingMilestoneBonus(runs: number): number {
  const r = clampNonNeg(runs)
  if (r >= 100) return 40
  if (r >= 75) return 25
  if (r >= 50) return 15
  if (r >= 30) return 5
  return 0
}

/** Single highest tier for total wickets in the match for this player. */
export function getWicketCountMilestoneBonus(wickets: number): number {
  const w = Math.floor(clampNonNeg(wickets))
  if (w >= 5) return 50
  if (w >= 4) return 30
  if (w >= 3) return 20
  if (w >= 2) return 10
  return 0
}

function countBowledLbwExtras(dismissalTypes: string[], wicketCap: number): number {
  const cap = Math.max(0, Math.floor(wicketCap))
  if (cap <= 0) return 0
  let n = 0
  for (const how of dismissalTypes) {
    if (isBowledOrLbwDismissal(how)) n += 1
  }
  return Math.min(n, cap)
}

function optionalBreakdownField(key: keyof MvpScoreBreakdown, value: number): Partial<MvpScoreBreakdown> {
  if (!Number.isFinite(value) || value === 0) return {}
  return { [key]: value } as Partial<MvpScoreBreakdown>
}

/**
 * Full MVP points for one player in one match.
 *
 * @example
 * ```ts
 * const ctx: MvpMatchContext = { winningTeamId: 'team-a', topScorerPlayerId: 'p-oppo-1' }
 * const stats: MvpPlayerStats = {
 *   playerId: 'p-1',
 *   teamId: 'team-a',
 *   runs: 48,
 *   balls: 32,
 *   fours: 6,
 *   sixes: 1,
 *   wickets: 2,
 *   maidenOvers: 1,
 *   oversBowled: 3,
 *   runsConceded: 14,
 *   catches: 1,
 *   stumpings: 0,
 *   runOuts: 0,
 *   ducks: false,
 *   dismissalTypes: ['Bowled', 'Catch out'],
 *   dismissedPlayerIds: ['p-oppo-1'],
 * }
 * const mvp = computeMvpPointsForPlayer(stats, ctx)
 * // mvp.batting includes runs + boundaries + SR/milestone; mvp.impact includes win + top-scorer wicket, etc.
 * ```
 *
 * @example
 * ```ts
 * // Edge cases: no division by zero, SR bonus needs 10+ balls, economy bonus needs 2+ overs.
 * computeMvpPointsForPlayer(
 *   {
 *     playerId: 'x',
 *     teamId: 't',
 *     runs: 0,
 *     balls: 0,
 *     fours: 0,
 *     sixes: 0,
 *     wickets: 0,
 *     maidenOvers: 0,
 *     oversBowled: 0,
 *     runsConceded: 0,
 *     catches: 0,
 *     stumpings: 0,
 *     runOuts: 0,
 *     ducks: false,
 *     dismissalTypes: [],
 *   },
 *   { winningTeamId: '', topScorerPlayerId: '' },
 * )
 * ```
 */
export function computeMvpPointsForPlayer(stats: MvpPlayerStats, context: MvpMatchContext): MvpPointsResult {
  const runs = clampNonNeg(stats.runs)
  const balls = clampNonNeg(stats.balls)
  const fours = clampNonNeg(stats.fours)
  const sixes = clampNonNeg(stats.sixes)
  const wickets = clampNonNeg(stats.wickets)
  const maidenOvers = clampNonNeg(stats.maidenOvers)
  const oversBowled = clampNonNeg(stats.oversBowled)
  const runsConceded = clampNonNeg(stats.runsConceded)
  const catches = clampNonNeg(stats.catches)
  const stumpings = clampNonNeg(stats.stumpings)
  const runOuts = clampNonNeg(stats.runOuts)

  const runPts = runs
  const fourPts = fours
  const sixPts = sixes * 2
  const srBonus = getStrikeRateBonus(runs, balls)
  const milestone = getBattingMilestoneBonus(runs)

  // Duck: explicit flag and no runs scored; penalty does not stack with positive runs if data is inconsistent.
  const duckPenalty = stats.ducks && runs === 0 ? -5 : 0

  const batting =
    runPts + fourPts + sixPts + srBonus + milestone + duckPenalty

  const baseWicketPts = 25 * wickets
  const bowledLbwExtra = countBowledLbwExtras(stats.dismissalTypes ?? [], wickets) * 8
  const maidenPts = maidenOvers * 15
  const economy = calculateEconomy(runsConceded, oversBowled)
  const econBonus = getEconomyBonus(economy, oversBowled)
  const wkMilestone = getWicketCountMilestoneBonus(wickets)

  const bowling = baseWicketPts + bowledLbwExtra + maidenPts + econBonus + wkMilestone

  const catchPts = catches * 8
  const roPts = runOuts * 12
  const stumpPts = stumpings * 12
  const fielding = catchPts + roPts + stumpPts

  let impact = 0
  const winId = context.winningTeamId?.trim() ?? ''
  if (winId && stats.teamId === winId) impact += 15

  // Fast cameo: 20+ runs in at most 10 balls (and at least one ball faced).
  if (balls > 0 && balls <= 10 && runs >= 20) impact += 10

  const topId = context.topScorerPlayerId?.trim() ?? ''
  const dismissed = stats.dismissedPlayerIds ?? []
  if (topId && dismissed.includes(topId)) impact += 8

  if (stats.matchFinishingInnings) impact += 15

  const total = batting + bowling + fielding + impact

  const breakdown: MvpScoreBreakdown = {
    ...optionalBreakdownField('runs', runPts),
    ...optionalBreakdownField('fours', fourPts),
    ...optionalBreakdownField('sixes', sixPts),
    ...optionalBreakdownField('strikeRateBonus', srBonus),
    ...optionalBreakdownField('battingMilestones', milestone),
    ...optionalBreakdownField('duckPenalty', duckPenalty),
    ...optionalBreakdownField('wickets', baseWicketPts),
    ...optionalBreakdownField('bowledLbwBonus', bowledLbwExtra),
    ...optionalBreakdownField('maidens', maidenPts),
    ...optionalBreakdownField('economyBonus', econBonus),
    ...optionalBreakdownField('wicketMilestoneBonus', wkMilestone),
    ...optionalBreakdownField('catches', catchPts),
    ...optionalBreakdownField('runOuts', roPts),
    ...optionalBreakdownField('stumpings', stumpPts),
    ...optionalBreakdownField('impactBonus', impact),
  }

  return {
    total,
    batting,
    bowling,
    fielding,
    impact,
    breakdown,
  }
}
