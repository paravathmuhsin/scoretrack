import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type {
  MatchDoc,
  PlayerAggRow,
  StandingsTeamRow,
  TeamDoc,
  TournamentGroupDoc,
  TournamentLinkedTeamDoc,
} from '../types/models'
import { fetchMatchEvents } from './matchEvents'
import { effectiveMatchMvp } from './effectiveMatchPotm'
import { tournamentLeaguePoints } from './tournamentPoints'
import { replayEvents, type ReplayConfig, type ReplayState } from '../scoring/engine'
import { getDb } from '../firebase/config'

function nrr(rf: number, of: number, ra: number, oa: number): number {
  if (oa === 0 || of === 0) return 0
  const rr = rf / of
  const rc = ra / oa
  return Math.round((rr - rc) * 1000) / 1000
}

type RowAgg = {
  played: number
  won: number
  lost: number
  tied: number
  nr: number
  rf: number
  of: number
  ra: number
  oa: number
  name: string
}

function emptyRow(name: string): RowAgg {
  return { played: 0, won: 0, lost: 0, tied: 0, nr: 0, rf: 0, of: 0, ra: 0, oa: 0, name }
}

function battingTotalsFromReplay(state: ReplayState, bpo: number) {
  const i1 = state.innings1
  const i2 = state.innings2
  const homeBatRuns =
    (i1.battingSide === 'home' ? i1.runs : 0) + (i2?.battingSide === 'home' ? i2.runs : 0)
  const awayBatRuns =
    (i1.battingSide === 'away' ? i1.runs : 0) + (i2?.battingSide === 'away' ? i2.runs : 0)
  const homeBatBalls =
    (i1.battingSide === 'home' ? i1.legalBalls : 0) + (i2?.battingSide === 'home' ? i2.legalBalls : 0)
  const awayBatBalls =
    (i1.battingSide === 'away' ? i1.legalBalls : 0) + (i2?.battingSide === 'away' ? i2.legalBalls : 0)
  return {
    homeBatRuns,
    awayBatRuns,
    homeOversFor: homeBatBalls / bpo,
    awayOversFor: awayBatBalls / bpo,
  }
}

/** Each counted match adds one of W/L/T/NR per team; points come from {@link tournamentLeaguePoints}. */
async function aggregateOneMatch(
  md: QueryDocumentSnapshot,
  teamById: Map<string, TeamDoc & { id: string }>,
  rows: Map<string, RowAgg>,
  playerAgg: Map<string, PlayerAggRow> | null,
  matchFilter: (m: MatchDoc) => boolean,
): Promise<void> {
  const m = md.data() as MatchDoc
  if (!matchFilter(m) || !m.lineup) return

  const po = m.resultSummary?.pointsOutcome
  const isAbandonedNr = m.status === 'abandoned' && po === 'no_result'
  const isCompletedForced = m.status === 'completed' && po != null
  const isCompletedNatural = m.status === 'completed' && po == null
  if (!isAbandonedNr && !isCompletedForced && !isCompletedNatural) return

  const homeKey = m.home.tournamentTeamId ?? 'home'
  const awayKey = m.away.tournamentTeamId ?? 'away'
  const cfg: ReplayConfig = {
    squadSize: m.squadSize,
    oversLimit: m.oversLimit,
    ballsPerOver: m.ballsPerOver ?? 6,
    oversPerBowler: m.oversPerBowler ?? null,
    lineup: m.lineup,
    homeName: m.home.name,
    awayName: m.away.name,
  }
  const events = await fetchMatchEvents(md.id)
  const state = replayEvents(cfg, events)

  const i2 = state.innings2
  if (isCompletedNatural && !i2) return

  const bpo = m.ballsPerOver ?? 6
  const { homeBatRuns, awayBatRuns, homeOversFor, awayOversFor } = battingTotalsFromReplay(state, bpo)

  const bump = (tid: string, rf: number, ofb: number, ra: number, oab: number, w: 'W' | 'L' | 'T' | 'NR') => {
    if (!rows.has(tid))
      rows.set(tid, {
        ...emptyRow(teamById.get(tid)?.name ?? tid),
      })
    const r = rows.get(tid)!
    r.played += 1
    r.rf += rf
    r.of += ofb
    r.ra += ra
    r.oa += oab
    if (w === 'W') r.won += 1
    else if (w === 'L') r.lost += 1
    else if (w === 'T') r.tied += 1
    else r.nr += 1
  }

  const hk = homeKey
  const ak = awayKey

  if (isAbandonedNr || isCompletedForced) {
    const outcome = po
    if (outcome === 'no_result') {
      // NR / abandoned: points + played; zero RF/OF/RA/OA — NRR excludes this match only here.
      bump(hk, 0, 0, 0, 0, 'NR')
      bump(ak, 0, 0, 0, 0, 'NR')
    } else if (outcome === 'tie') {
      // Tie: include runs/overs in NRR aggregates (same as a finished scored tie).
      bump(hk, homeBatRuns, homeOversFor, awayBatRuns, awayOversFor, 'T')
      bump(ak, awayBatRuns, awayOversFor, homeBatRuns, homeOversFor, 'T')
    } else if (outcome === 'home_win') {
      bump(hk, homeBatRuns, homeOversFor, awayBatRuns, awayOversFor, 'W')
      bump(ak, awayBatRuns, awayOversFor, homeBatRuns, homeOversFor, 'L')
    } else if (outcome === 'away_win') {
      bump(ak, awayBatRuns, awayOversFor, homeBatRuns, homeOversFor, 'W')
      bump(hk, homeBatRuns, homeOversFor, awayBatRuns, awayOversFor, 'L')
    }
  } else {
    const winner = state.winner
    if (winner === 'tie') {
      bump(hk, homeBatRuns, homeOversFor, awayBatRuns, awayOversFor, 'T')
      bump(ak, awayBatRuns, awayOversFor, homeBatRuns, homeOversFor, 'T')
    } else if (winner === 'home') {
      bump(hk, homeBatRuns, homeOversFor, awayBatRuns, awayOversFor, 'W')
      bump(ak, awayBatRuns, awayOversFor, homeBatRuns, homeOversFor, 'L')
    } else if (winner === 'away') {
      bump(ak, awayBatRuns, awayOversFor, homeBatRuns, homeOversFor, 'W')
      bump(hk, homeBatRuns, homeOversFor, awayBatRuns, awayOversFor, 'L')
    }
  }

  if (!playerAgg) return

  for (const [pid, fig] of Object.entries(state.batterStats)) {
    const side = m.lineup!.homeXI.includes(pid) ? 'home' : 'away'
    const tid = side === 'home' ? hk : ak
    const name =
      m.home.players.find((p) => p.playerId === pid)?.name ??
      m.away.players.find((p) => p.playerId === pid)?.name ??
      pid
    const key = `${tid}_${pid}`
    const cur =
      playerAgg.get(key) ??
      ({
        playerId: pid,
        name,
        teamId: tid,
        runs: 0,
        balls: 0,
        wickets: 0,
        oversBowled: 0,
        runsConceded: 0,
        fieldingDismissals: 0,
        mvpScore: 0,
      } satisfies PlayerAggRow)
    cur.runs += fig.runs
    cur.balls += fig.balls
    cur.fours = (cur.fours ?? 0) + (fig.fours ?? 0)
    cur.sixes = (cur.sixes ?? 0) + (fig.sixes ?? 0)
    cur.highScore = Math.max(cur.highScore ?? 0, fig.runs)
    if (fig.out) cur.dismissals = (cur.dismissals ?? 0) + 1
    playerAgg.set(key, cur)
  }
  for (const [pid, fig] of Object.entries(state.bowlerStats)) {
    const side = m.lineup!.homeXI.includes(pid) ? 'home' : 'away'
    const tid = side === 'home' ? hk : ak
    const name =
      m.home.players.find((p) => p.playerId === pid)?.name ??
      m.away.players.find((p) => p.playerId === pid)?.name ??
      pid
    const key = `${tid}_${pid}`
    const cur =
      playerAgg.get(key) ??
      ({
        playerId: pid,
        name,
        teamId: tid,
        runs: 0,
        balls: 0,
        wickets: 0,
        oversBowled: 0,
        runsConceded: 0,
        fieldingDismissals: 0,
        mvpScore: 0,
      } satisfies PlayerAggRow)
    cur.wickets += fig.wickets
    cur.oversBowled += fig.balls / (m.ballsPerOver ?? 6)
    cur.runsConceded += fig.runs
    playerAgg.set(key, cur)
  }

  const mvp = effectiveMatchMvp({ ...m, id: md.id } as MatchDoc & { id: string }, cfg, events, state)
  for (const [pid, fg] of Object.entries(mvp.fieldingByPlayerId)) {
    const side = m.lineup!.homeXI.includes(pid) ? 'home' : 'away'
    const tid = side === 'home' ? hk : ak
    const name =
      m.home.players.find((p) => p.playerId === pid)?.name ??
      m.away.players.find((p) => p.playerId === pid)?.name ??
      pid
    const key = `${tid}_${pid}`
    const cur =
      playerAgg.get(key) ??
      ({
        playerId: pid,
        name,
        teamId: tid,
        runs: 0,
        balls: 0,
        wickets: 0,
        oversBowled: 0,
        runsConceded: 0,
        fieldingDismissals: 0,
        mvpScore: 0,
      } satisfies PlayerAggRow)
    const fd = fg.catches + fg.runOuts + fg.stumpings
    cur.fieldingDismissals += fd
    cur.catches = (cur.catches ?? 0) + fg.catches
    cur.runOuts = (cur.runOuts ?? 0) + fg.runOuts
    cur.stumpings = (cur.stumpings ?? 0) + fg.stumpings
    playerAgg.set(key, cur)
  }

  if (playerAgg) {
    for (const r of mvp.rows) {
      const tid = r.side === 'home' ? homeKey : awayKey
      const key = `${tid}_${r.playerId}`
      const cur = playerAgg.get(key)
      if (cur) cur.mvpScore += r.total
    }
    const potmPid = mvp.potm?.playerId
    if (potmPid) {
      const side = m.lineup!.homeXI.includes(potmPid) ? 'home' : 'away'
      const tid = side === 'home' ? hk : ak
      const key = `${tid}_${potmPid}`
      const cur = playerAgg.get(key)
      if (cur) cur.potmAwards = (cur.potmAwards ?? 0) + 1
    }
  }
}

function rowsToStandings(rows: Map<string, RowAgg>): StandingsTeamRow[] {
  const teams: StandingsTeamRow[] = [...rows.entries()].map(([teamId, r]) => ({
    teamId,
    teamName: r.name,
    played: r.played,
    won: r.won,
    lost: r.lost,
    tied: r.tied,
    nr: r.nr,
    points: tournamentLeaguePoints(r.won, r.tied, r.nr),
    runsFor: r.rf,
    oversFor: Math.round(r.of * 100) / 100,
    runsAgainst: r.ra,
    oversAgainst: Math.round(r.oa * 100) / 100,
    nrr: nrr(r.rf, Math.max(r.of, 0.001), r.ra, Math.max(r.oa, 0.001)),
  }))
  teams.sort((a, b) => b.points - a.points || b.nrr - a.nrr)
  return teams
}

/**
 * Rebuild standings + player aggregates for a tournament from completed matches.
 */
export async function recomputeTournament(tournamentId: string): Promise<void> {
  const db = getDb()
  const tSnap = await getDoc(doc(db, 'tournaments', tournamentId))
  const ownerUid =
    tSnap.exists() ? ((tSnap.data() as { createdBy?: string }).createdBy ?? '') : ''

  const teamById = new Map<string, TeamDoc & { id: string }>()

  const linkedSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'linkedTeams'))
  if (!linkedSnap.empty && ownerUid) {
    for (const d of linkedSnap.docs) {
      const row = d.data() as TournamentLinkedTeamDoc
      const ut = await getDoc(doc(db, 'users', ownerUid, 'teams', row.userTeamId))
      if (!ut.exists()) continue
      teamById.set(d.id, { id: d.id, ...(ut.data() as TeamDoc) })
    }
  }

  if (teamById.size === 0) {
    const teamsSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'teams'))
    teamsSnap.forEach((d) => {
      teamById.set(d.id, { id: d.id, ...(d.data() as TeamDoc) })
    })
  }

  const matchesSnap = await getDocs(
    query(collection(db, 'matches'), where('tournamentId', '==', tournamentId)),
  )

  const rows = new Map<string, RowAgg>()
  for (const [, t] of teamById) {
    rows.set(t.id, { ...emptyRow(t.name) })
  }

  const playerAgg = new Map<string, PlayerAggRow>()

  for (const md of matchesSnap.docs) {
    await aggregateOneMatch(md, teamById, rows, playerAgg, () => true)
  }

  const teams = rowsToStandings(rows)

  await setDoc(doc(db, 'tournaments', tournamentId, 'standings', 'summary'), {
    updatedAt: serverTimestamp(),
    teams,
  })

  const players = [...playerAgg.values()].sort((a, b) => b.mvpScore - a.mvpScore || b.runs - a.runs)
  await setDoc(doc(db, 'tournaments', tournamentId, 'stats', 'summary'), {
    updatedAt: serverTimestamp(),
    players,
  })

  const groupsSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'groups'))
  for (const gd of groupsSnap.docs) {
    const g = gd.data() as TournamentGroupDoc
    const groupRows = new Map<string, RowAgg>()
    for (const linkId of g.linkedTeamIds ?? []) {
      const tm = teamById.get(linkId)
      if (tm) groupRows.set(linkId, { ...emptyRow(tm.name) })
    }
    const gid = gd.id
    for (const md of matchesSnap.docs) {
      await aggregateOneMatch(md, teamById, groupRows, null, (m) => {
        return m.tournamentGroupId === gid && m.tournamentRound === 'league'
      })
    }
    const groupTeams = rowsToStandings(groupRows)
    await setDoc(doc(db, 'tournaments', tournamentId, 'standings', gid), {
      updatedAt: serverTimestamp(),
      teams: groupTeams,
      groupName: g.name,
    })
  }
}
