import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type Firestore,
} from 'firebase/firestore'
import type { MatchDoc, TeamDoc, TournamentScheduleKind } from '../types/models'
import { buildRosterPlayerIds } from './matchRosterIndex'
import { buildTournamentEntrySnapshot, tbdPlaceholderSnapshot } from './tournamentMatchSnapshots'

const DEFAULT_SQUAD = 11
const DEFAULT_OVERS = 20
const DEFAULT_OVERS_PER_BOWLER = 4

function firstRoundPairIndices(n: number): [number, number][] {
  const half = n / 2
  const out: [number, number][] = []
  for (let i = 0; i < half; i++) {
    out.push([i, n - 1 - i])
  }
  return out
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0
}

async function createScheduledMatch(
  db: Firestore,
  args: {
    tournamentId: string
    organiserUid: string
    home: MatchDoc['home']
    away: MatchDoc['away']
    scheduledAt: Date
    label: string
    fixtureSources?: MatchDoc['fixtureSources']
  },
): Promise<string> {
  const publicId = crypto.randomUUID()
  const ref = await addDoc(collection(db, 'matches'), {
    tournamentId: args.tournamentId,
    home: args.home,
    away: args.away,
    squadSize: DEFAULT_SQUAD,
    oversLimit: DEFAULT_OVERS,
    oversPerBowler: DEFAULT_OVERS_PER_BOWLER,
    ballsPerOver: 6,
    freeHitOnNoBall: false,
    scheduledAt: Timestamp.fromDate(args.scheduledAt),
    status: 'scheduled',
    createdBy: args.organiserUid,
    isPublic: true,
    publicId,
    lastEventSeq: 0,
    createdAt: serverTimestamp(),
    tournamentFixtureLabel: args.label,
    rosterPlayerIds: buildRosterPlayerIds(args.home, args.away),
    ...(args.fixtureSources ? { fixtureSources: args.fixtureSources } : {}),
  })
  return ref.id
}

/**
 * Deletes scheduled-only tournament matches (not live/completed/abandoned) to make room for a new draw.
 */
export async function deleteScheduledTournamentMatches(db: Firestore, tournamentId: string): Promise<number> {
  const snap = await getDocs(query(collection(db, 'matches'), where('tournamentId', '==', tournamentId)))
  let n = 0
  for (const d of snap.docs) {
    const st = (d.data() as MatchDoc).status
    if (st !== 'scheduled') continue
    await deleteDoc(doc(db, 'matches', d.id))
    n += 1
  }
  return n
}

export type LinkedTeamForSchedule = {
  linkId: string
  team: TeamDoc & { id: string }
}

export async function scheduleTournamentFixtures(opts: {
  db: Firestore
  tournamentId: string
  organiserUid: string
  mode: TournamentScheduleKind
  links: LinkedTeamForSchedule[]
  startTime: Date
  hoursBetweenMatches: number
}): Promise<{ createdIds: string[]; replacedScheduled: number }> {
  const { db, tournamentId, organiserUid, mode, startTime, hoursBetweenMatches } = opts
  const links = [...opts.links].sort((a, b) => a.team.name.localeCompare(b.team.name))
  if (links.length < 2) {
    throw new Error('Add at least two squads to the tournament (from My teams).')
  }

  const replacedScheduled = await deleteScheduledTournamentMatches(db, tournamentId)
  const createdIds: string[] = []
  let slot = 0
  const nextTime = () => new Date(startTime.getTime() + slot++ * hoursBetweenMatches * 60 * 60 * 1000)

  if (mode === 'round_robin') {
    for (let i = 0; i < links.length; i++) {
      for (let j = i + 1; j < links.length; j++) {
        const a = links[i]!
        const b = links[j]!
        const id = await createScheduledMatch(db, {
          tournamentId,
          organiserUid,
          home: buildTournamentEntrySnapshot(a.team, a.linkId),
          away: buildTournamentEntrySnapshot(b.team, b.linkId),
          scheduledAt: nextTime(),
          label: `RR · ${a.team.name} vs ${b.team.name}`,
        })
        createdIds.push(id)
      }
    }
    return { createdIds, replacedScheduled }
  }

  // knockout_single
  const n = links.length
  if (!isPowerOfTwo(n)) {
    throw new Error('Knockout needs a power-of-two number of squads (2, 4, 8, …). Add or remove linked teams.')
  }

  const pairs = firstRoundPairIndices(n)
  const round0Ids: string[] = []

  for (let p = 0; p < pairs.length; p++) {
    const [ia, ib] = pairs[p]!
    const ta = links[ia]!
    const tb = links[ib]!
    const id = await createScheduledMatch(db, {
      tournamentId,
      organiserUid,
      home: buildTournamentEntrySnapshot(ta.team, ta.linkId),
      away: buildTournamentEntrySnapshot(tb.team, tb.linkId),
      scheduledAt: nextTime(),
      label: `KO · R1 · ${ta.team.name} vs ${tb.team.name}`,
    })
    round0Ids.push(id)
    createdIds.push(id)
  }

  let prevRound = round0Ids
  let roundNum = 2
  while (prevRound.length > 1) {
    const nextRound: string[] = []
    for (let j = 0; j < prevRound.length; j += 2) {
      const left = prevRound[j]!
      const right = prevRound[j + 1]!
      const isFinal = prevRound.length === 2
      const id = await createScheduledMatch(db, {
        tournamentId,
        organiserUid,
        home: tbdPlaceholderSnapshot(),
        away: tbdPlaceholderSnapshot(),
        scheduledAt: nextTime(),
        label: isFinal ? 'Final' : `KO · R${roundNum}`,
        fixtureSources: {
          homeFromMatchId: left,
          awayFromMatchId: right,
        },
      })
      nextRound.push(id)
      createdIds.push(id)
    }
    prevRound = nextRound
    roundNum += 1
  }

  return { createdIds, replacedScheduled }
}
