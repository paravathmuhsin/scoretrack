import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { buildRosterPlayerIds } from './matchRosterIndex'
import type { MatchDoc, MatchTeamSnapshot, TournamentRoundType } from '../types/models'

const DEFAULT_SQUAD = 11
const DEFAULT_OVERS = 20
const DEFAULT_OVERS_PER_BOWLER = 4

export async function createScheduledTournamentMatch(
  db: Firestore,
  opts: {
    tournamentId: string
    organiserUid: string
    home: MatchTeamSnapshot
    away: MatchTeamSnapshot
    scheduledAt: Date
    label: string
    tournamentRound: TournamentRoundType
    tournamentGroupId?: string | null
    squadSize?: number
    oversLimit?: number
    oversPerBowler?: number
    fixtureSources?: MatchDoc['fixtureSources']
  },
): Promise<string> {
  const publicId = crypto.randomUUID()
  const ref = await addDoc(collection(db, 'matches'), {
    tournamentId: opts.tournamentId,
    home: opts.home,
    away: opts.away,
    squadSize: opts.squadSize ?? DEFAULT_SQUAD,
    oversLimit: opts.oversLimit ?? DEFAULT_OVERS,
    oversPerBowler: opts.oversPerBowler ?? DEFAULT_OVERS_PER_BOWLER,
    ballsPerOver: 6,
    freeHitOnNoBall: false,
    scheduledAt: Timestamp.fromDate(opts.scheduledAt),
    status: 'scheduled',
    createdBy: opts.organiserUid,
    isPublic: true,
    publicId,
    lastEventSeq: 0,
    createdAt: serverTimestamp(),
    tournamentFixtureLabel: opts.label,
    tournamentRound: opts.tournamentRound,
    tournamentGroupId: opts.tournamentGroupId ?? null,
    rosterPlayerIds: buildRosterPlayerIds(opts.home, opts.away),
    ...(opts.fixtureSources ? { fixtureSources: opts.fixtureSources } : {}),
  })
  return ref.id
}
