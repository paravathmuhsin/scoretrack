import {
  type Firestore,
  writeBatch,
  doc,
  serverTimestamp,
  increment,
  getDoc,
} from 'firebase/firestore'
import {
  bowlingStatsPerInnings,
  type PerInningsBowler,
  type ReplayConfig,
  type ReplayState,
  type ScoreEvent,
} from '../scoring/engine'
import { computeMatchMvp } from './mvpMatch'
import type { MatchDoc, MatchPlayerStatsDoc, PlayerCareerStatsDoc, PlayerOfTheMatchResult } from '../types/models'

export function buildPlayerOfTheMatchResult(mvp: ReturnType<typeof computeMatchMvp>): PlayerOfTheMatchResult | null {
  if (!mvp.potm || !mvp.potmSource) return null
  return {
    playerId: mvp.potm.playerId,
    side: mvp.potm.side,
    name: mvp.potm.name,
    note: mvp.potmNote,
    source: mvp.potmSource,
  }
}

function xiIds(match: MatchDoc): string[] {
  const h = match.lineup?.homeXI ?? []
  const a = match.lineup?.awayXI ?? []
  return [...new Set([...h, ...a])]
}

/** Load current career docs for XI players (for high score / best bowling merge in the completion batch). */
export async function fetchCareerRollupsForXi(
  db: Firestore,
  match: MatchDoc & { id: string },
): Promise<Record<string, Partial<PlayerCareerStatsDoc> | null>> {
  const ids = xiIds(match)
  const entries = await Promise.all(
    ids.map(async (pid) => {
      const snap = await getDoc(doc(db, 'playerCareerStats', pid))
      return [pid, snap.exists() ? (snap.data() as PlayerCareerStatsDoc) : null] as const
    }),
  )
  return Object.fromEntries(entries)
}

function pickBestInningsFigure(
  a: PerInningsBowler | undefined,
  b: PerInningsBowler | undefined,
): { w: number; r: number } | null {
  const cands: { w: number; r: number }[] = []
  for (const fig of [a, b]) {
    if (!fig) continue
    if (fig.legalBalls > 0 || fig.wickets > 0) cands.push({ w: fig.wickets, r: fig.runs })
  }
  if (cands.length === 0) return null
  return cands.reduce((best, cur) =>
    cur.w > best.w || (cur.w === best.w && cur.r < best.r) ? cur : best,
  )
}

function mergeBestBowling(
  prior: { w: number; r: number } | null | undefined,
  matchBest: { w: number; r: number } | null,
): { w: number; r: number } | null {
  if (!matchBest || matchBest.w <= 0) return prior ?? null
  if (!prior || prior.w <= 0) return matchBest
  if (matchBest.w > prior.w || (matchBest.w === prior.w && matchBest.r < prior.r)) return matchBest
  return prior
}

/**
 * Writes `playerOfTheMatchResult`, per-XI `playerStats` rows, and career rollups when a match is completed.
 * Caller should include the match `updateDoc` in the same batch (pass batch + matchRef updates).
 */
export function applyMatchCompletionStatsToBatch(
  batch: ReturnType<typeof writeBatch>,
  db: Firestore,
  match: MatchDoc & { id: string },
  cfg: ReplayConfig,
  state: ReplayState,
  events: ScoreEvent[],
  playerOfTheMatchResult: PlayerOfTheMatchResult | null,
  existingCareerByPlayerId: Record<string, Partial<PlayerCareerStatsDoc> | null>,
): void {
  const mvp = computeMatchMvp(match, cfg, events, state)
  const ids = xiIds(match)
  const mid = match.id
  const tid = match.tournamentId ?? null
  const isPublic = match.isPublic === true
  const perInn = bowlingStatsPerInnings(cfg, events)

  for (const pid of ids) {
    const prior = existingCareerByPlayerId[pid] ?? null
    const bs = state.batterStats[pid] ?? { runs: 0, balls: 0, fours: 0, sixes: 0, out: false }
    const bw = state.bowlerStats[pid] ?? { balls: 0, runs: 0, wickets: 0 }
    const fd = mvp.fieldingByPlayerId[pid] ?? { catches: 0, runOuts: 0, stumpings: 0 }
    const name =
      match.home.players.find((p) => p.playerId === pid)?.name ??
      match.away.players.find((p) => p.playerId === pid)?.name ??
      pid
    const wasPotm = Boolean(playerOfTheMatchResult && playerOfTheMatchResult.playerId === pid)

    const facedBattingInnings = bs.balls > 0 || bs.runs > 0 || bs.out
    const battingInningsThis = facedBattingInnings ? 1 : 0
    const notOutThis = (bs.balls > 0 || bs.runs > 0) && !bs.out ? 1 : 0
    const dismissThis = bs.out ? 1 : 0
    const hundredsThis = bs.runs >= 100 ? 1 : 0
    const fiftiesThis = bs.runs >= 50 && bs.runs < 100 ? 1 : 0
    const nextHighScore = Math.max(prior?.highScore ?? 0, bs.runs)

    const fig1 = perInn.innings1[pid]
    const fig2 = perInn.innings2[pid]
    let bowlingInningsThis = 0
    let fourWThis = 0
    let fiveWThis = 0
    for (const fig of [fig1, fig2]) {
      if (!fig) continue
      if (fig.legalBalls <= 0 && fig.wickets <= 0) continue
      bowlingInningsThis += 1
      if (fig.wickets === 4) fourWThis += 1
      if (fig.wickets >= 5 && fig.wickets < 10) fiveWThis += 1
    }
    const combinedWickets = (fig1?.wickets ?? 0) + (fig2?.wickets ?? 0)
    const tenWMatchThis = combinedWickets >= 10 ? 1 : 0
    const bowlingMatThis = bw.balls > 0 ? 1 : 0

    const matchBestFig = pickBestInningsFigure(fig1, fig2)
    const mergedBest = mergeBestBowling(
      prior?.bestBowlingWickets != null &&
        prior.bestBowlingWickets > 0 &&
        prior.bestBowlingRunsConceded != null
        ? { w: prior.bestBowlingWickets, r: prior.bestBowlingRunsConceded }
        : null,
      matchBestFig,
    )

    const rowRef = doc(db, 'matches', mid, 'playerStats', pid)
    const row: Omit<MatchPlayerStatsDoc, 'updatedAt'> & { updatedAt: ReturnType<typeof serverTimestamp> } = {
      playerId: pid,
      name,
      matchId: mid,
      isPublic,
      tournamentId: tid,
      sourceMatchId: mid,
      updatedAt: serverTimestamp(),
      battingRuns: bs.runs,
      battingBalls: bs.balls,
      battingFours: bs.fours,
      battingSixes: bs.sixes,
      battingDismissals: dismissThis,
      battingInnings: battingInningsThis,
      battingNotOuts: notOutThis,
      battingHundreds: hundredsThis,
      battingFifties: fiftiesThis,
      battingHighScore: bs.runs,
      bowlingBalls: bw.balls,
      bowlingRuns: bw.runs,
      bowlingWickets: bw.wickets,
      bowlingMatches: bowlingMatThis,
      bowlingInnings: bowlingInningsThis,
      bowlingFourWicketInnings: fourWThis,
      bowlingFiveWicketInnings: fiveWThis,
      bowlingTenWicketMatch: tenWMatchThis,
      ...(matchBestFig && matchBestFig.w > 0
        ? { bestBowlingWickets: matchBestFig.w, bestBowlingRunsConceded: matchBestFig.r }
        : {}),
      fieldingCatches: fd.catches,
      fieldingRunOuts: fd.runOuts,
      fieldingStumpings: fd.stumpings,
      wasPotm,
    }
    batch.set(rowRef, row, { merge: true })

    const careerRef = doc(db, 'playerCareerStats', pid)
    const potmIncr = wasPotm ? 1 : 0
    const careerPatch: Record<string, unknown> = {
      playerId: pid,
      displayName: name,
      updatedAt: serverTimestamp(),
      sourceMatchId: mid,
      matchesPlayed: increment(1),
      potmAwards: increment(potmIncr),
      runs: increment(bs.runs),
      balls: increment(bs.balls),
      wickets: increment(bw.wickets),
      bowlingBalls: increment(bw.balls),
      runsConceded: increment(bw.runs),
      fieldingCatches: increment(fd.catches),
      fieldingRunOuts: increment(fd.runOuts),
      fieldingStumpings: increment(fd.stumpings),
      battingInnings: increment(battingInningsThis),
      notOuts: increment(notOutThis),
      battingDismissals: increment(dismissThis),
      hundreds: increment(hundredsThis),
      fifties: increment(fiftiesThis),
      battingFours: increment(bs.fours),
      battingSixes: increment(bs.sixes),
      highScore: nextHighScore,
      bowlingMatches: increment(bowlingMatThis),
      bowlingInnings: increment(bowlingInningsThis),
      bowlingFourWicketInnings: increment(fourWThis),
      bowlingFiveWicketInnings: increment(fiveWThis),
      bowlingTenWicketMatches: increment(tenWMatchThis),
    }
    if (mergedBest && mergedBest.w > 0) {
      careerPatch.bestBowlingWickets = mergedBest.w
      careerPatch.bestBowlingRunsConceded = mergedBest.r
    }
    if (isPublic) {
      careerPatch.isPublicAggregate = true
    }
    batch.set(careerRef, careerPatch, { merge: true })
  }
}

/** When POTM changes after completion, adjust career counters and rewrite `wasPotm` on match playerStats. */
export async function syncPotmChangeAfterComplete(
  db: Firestore,
  match: MatchDoc & { id: string },
  _cfg: ReplayConfig,
  _state: ReplayState,
  _events: ScoreEvent[],
  previousPotmPlayerId: string | null,
  nextResult: PlayerOfTheMatchResult | null,
): Promise<void> {
  const batch = writeBatch(db)
  const mid = match.id
  const isPublic = match.isPublic === true

  for (const pid of xiIds(match)) {
    const wasPotm = Boolean(nextResult && nextResult.playerId === pid)
    const rowRef = doc(db, 'matches', mid, 'playerStats', pid)
    batch.set(rowRef, { wasPotm, updatedAt: serverTimestamp() }, { merge: true })
  }

  const prev = previousPotmPlayerId?.trim() || null
  const next = nextResult?.playerId?.trim() || null

  if (prev && prev !== next) {
    const ref = doc(db, 'playerCareerStats', prev)
    batch.set(
      ref,
      { potmAwards: increment(-1), updatedAt: serverTimestamp(), sourceMatchId: mid },
      { merge: true },
    )
  }
  if (next && next !== prev) {
    const nextPatch: Record<string, unknown> = {
      playerId: next,
      ...(nextResult?.name?.trim() ? { displayName: nextResult.name.trim() } : {}),
      potmAwards: increment(1),
      updatedAt: serverTimestamp(),
      sourceMatchId: mid,
    }
    if (isPublic) {
      nextPatch.isPublicAggregate = true
    }
    batch.set(doc(db, 'playerCareerStats', next), nextPatch, { merge: true })
  }

  await batch.commit()
}

export async function incrementPottForPlayer(
  db: Firestore,
  playerId: string,
  sourceTournamentId: string,
  tournamentIsPublic: boolean,
  displayName?: string,
): Promise<void> {
  const ref = doc(db, 'playerCareerStats', playerId)
  const batch = writeBatch(db)
  batch.set(
    ref,
    {
      playerId,
      ...(displayName?.trim() ? { displayName: displayName.trim() } : {}),
      pottAwards: increment(1),
      updatedAt: serverTimestamp(),
      sourceTournamentId,
      ...(tournamentIsPublic ? { isPublicAggregate: true } : {}),
    } as Record<string, unknown>,
    { merge: true },
  )
  await batch.commit()
}
