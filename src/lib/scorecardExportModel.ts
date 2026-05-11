import { formatBattingScorecardStatus } from './battingScorecardFormat'
import { matchTeamShortLabel } from './teamAvatarLabel'
import { playerRoleMarkersPlain } from './matchPlayerRoles'
import { humanizeResultForMatch } from './humanizeResultText'
import { type MatchMvpResult } from './mvpMatch'
import { effectiveMatchMvp } from './effectiveMatchPotm'
import { buildPlayerNameLookup } from './playerDisplayName'
import { wicketsTimeline, type FallOfWicketInfo } from './publicLiveAnalytics'
import type { MatchDoc, RosterPlayer, Side } from '../types/models'
import {
  bowlingStatsPerInnings,
  opp,
  oversProgressString,
  oversString,
  type InningsSnapshot,
  type PerInningsBowler,
  type ReplayConfig,
  type ReplayState,
  type ScoreEvent,
} from '../scoring/engine'

export type BattingPdfRow = {
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  sr: string
  status: string
  notOutStar: boolean
}

export type BowlingPdfRow = {
  name: string
  overs: string
  maidens: number
  runs: number
  wickets: number
  econ: string
}

export type InningsPdfSection = {
  innings: 1 | 2
  battingTeamName: string
  bowlingTeamName: string
  battingSide: Side
  innSnap: InningsSnapshot
  battingRows: BattingPdfRow[]
  extras: number
  totalRuns: number
  totalWickets: number
  oversStr: string
  rr: string
  fallOfWickets: string | null
  yetToBat: string[] | null
  bowlingRows: BowlingPdfRow[]
}

export type ScorecardPdfModel = {
  homeName: string
  awayName: string
  /** `shortName` on snapshot when set, else full name — MVP table etc. */
  homeTeamShort: string
  awayTeamShort: string
  eyebrow: string
  resultLine: string | null
  /** When the organiser ended the match early with a note. */
  resultEndReasonLine: string | null
  tossLine: string | null
  heroRows: { team: string; score: string; sub: string }[]
  innings: InningsPdfSection[]
  mvp: MatchMvpResult
  /** False for abandoned matches — PDF omits the MVP section. */
  includeMvpSection: boolean
}

function xiPlayers(match: MatchDoc, side: Side): RosterPlayer[] {
  const xi = match.lineup?.[side === 'home' ? 'homeXI' : 'awayXI'] ?? []
  const pool = side === 'home' ? match.home.players : match.away.players
  return pool.filter((p) => xi.includes(p.playerId))
}

function formatScheduled(at: unknown): string | null {
  if (!at || typeof at !== 'object' || !('toDate' in at)) return null
  if (typeof (at as { toDate?: () => Date }).toDate !== 'function') return null
  const d = (at as { toDate: () => Date }).toDate()
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function tossLine(match: MatchDoc): string | null {
  if (!match.toss) return null
  const winner = match.toss.winnerSide === 'home' ? match.home.name : match.away.name
  const el = match.toss.elected === 'bat' ? 'bat' : 'bowl'
  return `${winner} chose to ${el}`
}

function inningsExtras(inn: InningsSnapshot, battingSide: Side, match: MatchDoc, state: ReplayState): number {
  const xi = xiPlayers(match, battingSide)
  let sumBat = 0
  for (const p of xi) {
    sumBat += state.batterStats[p.playerId]?.runs ?? 0
  }
  return Math.max(0, inn.runs - sumBat)
}

function sr(runs: number, balls: number): string {
  if (balls <= 0) return '—'
  return ((runs / balls) * 100).toFixed(2)
}

function economy(runs: number, legalBalls: number, ballsPerOver: number): string {
  if (legalBalls <= 0) return '0.00'
  const overs = legalBalls / ballsPerOver
  return (runs / overs).toFixed(2)
}

function bowlerOversDisplay(legalBalls: number, ballsPerOver: number): string {
  if (legalBalls <= 0) return '0'
  return oversString(legalBalls, ballsPerOver)
}

function inningsRunRateDisplay(runs: number, legalBalls: number, ballsPerOver: number): string {
  if (legalBalls <= 0) return '—'
  const overs = legalBalls / ballsPerOver
  return (runs / overs).toFixed(2)
}

function notOutAsterisk(
  bs: { out?: boolean; how?: string } | undefined,
  inn: InningsSnapshot,
  playerId: string,
): boolean {
  if (inn.dismissed.has(playerId)) return false
  if (inn.retiredOffField.has(playerId)) return false
  if (bs?.out) return false
  return true
}

function formatFallOfWicketEntry(
  match: MatchDoc & { id: string },
  battingSide: Side,
  resolve: (pid: string) => string,
  f: FallOfWicketInfo,
  ballsPerOver: number,
): string {
  const nm =
    resolve(f.dismissedId) + playerRoleMarkersPlain(match, battingSide, f.dismissedId)
  return `${f.wickets}-${f.runs} (${nm}, ${oversString(f.legalBalls, ballsPerOver)} ov)`
}

function buildInningsSection(
  resolve: (playerId: string) => string,
  inningsPick: 1 | 2,
  match: MatchDoc & { id: string },
  cfg: ReplayConfig,
  state: ReplayState,
  events: ScoreEvent[],
  splitBowling: ReturnType<typeof bowlingStatsPerInnings>,
): InningsPdfSection | null {
  const innSnap = inningsPick === 1 ? state.innings1 : state.innings2
  if (!innSnap) return null

  const battingSideForTab = innSnap.battingSide
  const bowlingSide = opp(battingSideForTab)
  const agg = inningsPick === 1 ? splitBowling.innings1 : splitBowling.innings2

  const xiBat = xiPlayers(match, battingSideForTab)
  const batted: typeof xiBat = []
  const yetTo: typeof xiBat = []
  for (const p of xiBat) {
    const bs = state.batterStats[p.playerId]
    const isOut = bs?.out
    const onCrease = innSnap.strikerId === p.playerId || innSnap.nonStrikerId === p.playerId
    const touched =
      (bs && (bs.balls > 0 || bs.runs > 0)) ||
      isOut ||
      onCrease ||
      innSnap.retiredOffField.has(p.playerId)
    if (touched) batted.push(p)
    else yetTo.push(p)
  }

  const bowlRows: { id: string; name: string; stats: PerInningsBowler }[] = []
  const bowlingXiIds = new Set(xiPlayers(match, bowlingSide).map((p) => p.playerId))
  for (const [id, st] of Object.entries(agg)) {
    if (!bowlingXiIds.has(id) || (st.legalBalls === 0 && st.runs === 0 && st.wickets === 0)) continue
    bowlRows.push({ id, name: resolve(id), stats: st })
  }
  bowlRows.sort((a, b) => b.stats.legalBalls - a.stats.legalBalls)

  const ext = inningsExtras(innSnap, battingSideForTab, match, state)
  const fowList = wicketsTimeline(events, inningsPick, battingSideForTab)
  const fallOfWickets =
    fowList.length > 0
      ? fowList.map((f) =>
          formatFallOfWicketEntry(match, battingSideForTab, resolve, f, cfg.ballsPerOver),
        ).join(', ')
      : null

  const battingRows: BattingPdfRow[] = batted.map((p) => {
    const bs = state.batterStats[p.playerId]
    const runs = bs?.runs ?? 0
    const balls = bs?.balls ?? 0
    return {
      name:
        resolve(p.playerId) + playerRoleMarkersPlain(match, battingSideForTab, p.playerId),
      runs,
      balls,
      fours: bs?.fours ?? 0,
      sixes: bs?.sixes ?? 0,
      sr: sr(runs, balls),
      status: formatBattingScorecardStatus(match, bs, innSnap, p.playerId),
      notOutStar: notOutAsterisk(bs, innSnap, p.playerId),
    }
  })

  const bowlingPdf: BowlingPdfRow[] = bowlRows.map(({ name, stats }) => ({
    name,
    overs: bowlerOversDisplay(stats.legalBalls, cfg.ballsPerOver),
    maidens: 0,
    runs: stats.runs,
    wickets: stats.wickets,
    econ: economy(stats.runs, stats.legalBalls, cfg.ballsPerOver),
  }))

  return {
    innings: inningsPick,
    battingTeamName: battingSideForTab === 'home' ? match.home.name : match.away.name,
    bowlingTeamName: bowlingSide === 'home' ? match.home.name : match.away.name,
    battingSide: battingSideForTab,
    innSnap,
    battingRows,
    extras: ext,
    totalRuns: innSnap.runs,
    totalWickets: innSnap.wickets,
    oversStr: oversString(innSnap.legalBalls, cfg.ballsPerOver),
    rr: inningsRunRateDisplay(innSnap.runs, innSnap.legalBalls, cfg.ballsPerOver),
    fallOfWickets,
    yetToBat:
      yetTo.length > 0
        ? yetTo.map(
            (p) =>
              resolve(p.playerId) + playerRoleMarkersPlain(match, battingSideForTab, p.playerId),
          )
        : null,
    bowlingRows: bowlingPdf,
  }
}

/** Builds the same logical scorecard + MVP data shown on the public `/live/:id` page. */
export function buildScorecardPdfModel(
  match: MatchDoc & { id: string },
  cfg: ReplayConfig,
  state: ReplayState,
  events: ScoreEvent[],
): ScorecardPdfModel {
  const resolve = buildPlayerNameLookup(match, events)
  const splitBowling = bowlingStatsPerInnings(cfg, events)
  const inn1Bat = state.innings1.battingSide
  const scheduled = formatScheduled(match.scheduledAt)
  const eyebrowParts = [`${match.home.name} vs ${match.away.name}`]
  if (scheduled) eyebrowParts.push(scheduled)
  eyebrowParts.push(`${cfg.oversLimit}-over match`)

  const teamFirstName = inn1Bat === 'home' ? match.home.name : match.away.name
  const teamSecondName = opp(inn1Bat) === 'home' ? match.home.name : match.away.name

  const heroRows: ScorecardPdfModel['heroRows'] = [
    {
      team: teamFirstName,
      score: `${state.innings1.runs}/${state.innings1.wickets}`,
      sub: `(${oversProgressString(state.innings1.legalBalls, cfg.ballsPerOver, cfg.oversLimit)} ov)`,
    },
  ]
  if (state.innings2) {
    heroRows.push({
      team: teamSecondName,
      score: `${state.innings2.runs}/${state.innings2.wickets}`,
      sub: `(${oversProgressString(state.innings2.legalBalls, cfg.ballsPerOver, cfg.oversLimit)} ov)`,
    })
  } else {
    heroRows.push({
      team: teamSecondName,
      score: 'Yet to bat',
      sub: '',
    })
  }

  const resultLine = state.matchComplete
    ? humanizeResultForMatch(match.resultSummary?.text ?? state.resultText ?? 'Match complete', match)
    : null
  const resultEndReasonLine =
    state.matchComplete && match.resultSummary?.endReason?.trim()
      ? `Reason: ${match.resultSummary.endReason.trim()}`
      : null

  const innings: InningsPdfSection[] = []
  const s1 = buildInningsSection(resolve, 1, match, cfg, state, events, splitBowling)
  if (s1) innings.push(s1)
  const s2 = buildInningsSection(resolve, 2, match, cfg, state, events, splitBowling)
  if (s2) innings.push(s2)

  const emptyMvp: MatchMvpResult = {
    rows: [],
    potm: null,
    potmNote: null,
    potmSource: null,
    fieldingByPlayerId: {},
  }
  const mvpRaw =
    match.status === 'abandoned' ? emptyMvp : effectiveMatchMvp(match, cfg, events, state)
  const mvp: MatchMvpResult = {
    ...mvpRaw,
    rows: mvpRaw.rows.map((r) => ({
      ...r,
      name: resolve(r.playerId),
    })),
    potm: mvpRaw.potm
      ? {
          ...mvpRaw.potm,
          name: resolve(mvpRaw.potm.playerId),
        }
      : null,
  }

  return {
    homeName: match.home.name,
    awayName: match.away.name,
    homeTeamShort: matchTeamShortLabel(match.home),
    awayTeamShort: matchTeamShortLabel(match.away),
    eyebrow: eyebrowParts.join(' · '),
    resultLine,
    resultEndReasonLine,
    tossLine: tossLine(match),
    heroRows,
    innings,
    mvp,
    includeMvpSection: match.status !== 'abandoned',
  }
}
