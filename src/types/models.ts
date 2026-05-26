import type { Timestamp } from 'firebase/firestore'

export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'abandoned'
export type Side = 'home' | 'away'

export interface RosterPlayer {
  playerId: string
  name: string
}

export interface MatchTeamSnapshot {
  name: string
  /** Copied from squad `shortName` when the match is created; legacy matches may omit. */
  shortName?: string
  players: RosterPlayer[]
  tournamentTeamId?: string
  /** Source doc id under users/{uid}/teams/{userTeamId} */
  userTeamId?: string
  /** When squad lives under another user's teams path (co-owned squad). */
  userTeamOwnerUid?: string
  /** Internal friendly: temp side names without a linked My teams doc. */
  isTemporarySide?: boolean
}

/** Parent squad for an internal friendly (`users/{ownerUid}/teams/{teamId}`). */
export interface ParentUserTeamRef {
  ownerUid: string
  teamId: string
  name: string
  shortName?: string
}

export interface TossInfo {
  winnerSide: Side
  elected: 'bat' | 'field'
}

export interface MatchLineup {
  innings1BattingSide: Side
  homeXI: string[]
  awayXI: string[]
  strikerId: string
  nonStrikerId: string
  bowlerId: string
  /** Set at match start from each XI (used e.g. for stumping fielder default). */
  homeCaptainId?: string
  homeKeeperId?: string
  awayCaptainId?: string
  awayKeeperId?: string
}

/** How a tournament fixture was generated (optional). */
export type TournamentScheduleKind = 'round_robin' | 'knockout_single'

/** Stage / round type stored on tournament matches. */
export type TournamentRoundType =
  | 'league'
  | 'knockout'
  | 'quarter_final'
  | 'semi_final'
  | 'final'

/**
 * For knockout placeholders: this match’s home/away is filled when the feeder match finishes.
 */
export interface MatchFixtureSources {
  homeFromMatchId?: string | null
  awayFromMatchId?: string | null
}

/** Manual overlay preview target (Firestore + manage page). */
export type OverlayPreviewPrimary = 'scoreBarOnly' | 'batting' | 'bowling' | 'summary'

/** Persisted overlay preferences on the match doc (OBS reads via match subscription). */
export interface MatchOverlayPrefs {
  /** Default length for “Preview” actions from manage overlay (seconds). */
  previewDurationSec?: number
}

/** Temporary forced primary on the public overlay until `until` (set from manage page). */
export interface MatchOverlayPreview {
  primary: OverlayPreviewPrimary
  until: Timestamp
}

export interface MatchDoc {
  tournamentId: string | null
  home: MatchTeamSnapshot
  away: MatchTeamSnapshot
  squadSize: number
  oversLimit: number
  /** Max overs each bowler may bowl per innings; omit or null = no limit */
  oversPerBowler?: number | null
  ballsPerOver: number
  /**
   * When true, the next delivery after a no-ball is scored as a free hit (restricted dismissals).
   * Omit or false for legacy matches / formats without free hits.
   */
  freeHitOnNoBall?: boolean
  scheduledAt: Timestamp
  status: MatchStatus
  createdBy: string
  isPublic: boolean
  /** Share token for `/live/:publicId` and `/overlay/:publicId`; legacy matches may omit until generated in-app. */
  publicId?: string
  /** Set on create; legacy matches may omit. */
  createdAt?: Timestamp
  startedAt?: Timestamp
  completedAt?: Timestamp
  toss?: TossInfo
  lineup?: MatchLineup
  resultSummary?: {
    winnerSide: Side | 'tie' | null
    text: string
    /** Set when the organiser ends the match from settings (not a natural last-ball finish). */
    endReason?: string
    /**
     * When the organiser forces the final table outcome (early end / abandon).
     * Omitted for a normal ball-by-ball finish — standings use replay `winner` then.
     */
    pointsOutcome?: 'home_win' | 'away_win' | 'tie' | 'no_result'
  }
  lastEventSeq?: number
  /** Set when auto-scheduled from the tournament (round robin / knockout). */
  tournamentFixtureLabel?: string
  /** Knockout: which matches must complete before this one is playable. */
  fixtureSources?: MatchFixtureSources
  /** League pool / group stage (linkedTeams doc ids reference group membership). */
  tournamentRound?: TournamentRoundType | null
  /** When set, match counts toward this group’s points table (league stage). */
  tournamentGroupId?: string | null
  /** Friendly-only venue / ground (optional). Tournament venue uses `tournaments/{id}.location`. */
  venue?: string | null
  /** Stream overlay: prefs (e.g. preview duration). */
  overlayPrefs?: MatchOverlayPrefs
  /** Stream overlay: time-limited forced primary from manage page. */
  overlayPreview?: MatchOverlayPreview | null
  /**
   * When set, public MVP / Player of the Match uses this XI player instead of the automatic MVP pick.
   * Omit or clear for automatic selection.
   */
  playerOfTheMatchPlayerId?: string
  /**
   * Resolved POTM written when the match is saved as `completed` (and updated if the organiser changes POTM).
   * Prefer this over recomputing MVP for public scorecard / PDFs.
   */
  playerOfTheMatchResult?: PlayerOfTheMatchResult | null
  /** Friendly internal squad match (temp home/away from one parent roster). */
  isInternalMatch?: boolean
  parentUserTeamRef?: ParentUserTeamRef
  /** Internal only: full parent roster at create — home listing for whole squad. */
  parentTeamMemberIds?: string[]
  /** Union of home.players + away.players (squad roster, not playing XI). */
  rosterPlayerIds?: string[]
}

/** Persisted effective Player of the Match after the match is completed. */
export interface PlayerOfTheMatchResult {
  playerId: string
  side: Side
  name: string
  note: string | null
  source: 'manual' | 'auto'
}

/** `matches/{matchId}/playerStats/{playerId}` — materialised row when a match completes. */
export interface MatchPlayerStatsDoc {
  playerId: string
  name: string
  matchId: string
  /** Denormalised for rules / collection queries. */
  isPublic: boolean
  tournamentId: string | null
  /** Match doc id used when incrementing career rollups (same as matchId). */
  sourceMatchId: string
  updatedAt: Timestamp
  battingRuns: number
  battingBalls: number
  battingFours: number
  battingSixes: number
  battingDismissals: number
  /** This match: counted an innings batted if they faced a ball, scored, or were dismissed. */
  battingInnings?: number
  /** This match: not-out innings (batted and not dismissed). */
  battingNotOuts?: number
  battingHundreds?: number
  battingFifties?: number
  /** Highest score in this match (same as battingRuns for one innings). */
  battingHighScore?: number
  bowlingBalls: number
  bowlingRuns: number
  bowlingWickets: number
  bowlingMatches?: number
  bowlingInnings?: number
  bowlingFourWicketInnings?: number
  bowlingFiveWicketInnings?: number
  /** Match where combined wickets across innings ≥ 10. */
  bowlingTenWicketMatch?: number
  bestBowlingWickets?: number
  bestBowlingRunsConceded?: number
  fieldingCatches: number
  fieldingRunOuts: number
  fieldingStumpings: number
  wasPotm: boolean
  /** True when this player was their side’s captain in the match. */
  wasCaptain?: boolean
  /** Set when the match is an internal friendly. */
  parentUserTeamRef?: ParentUserTeamRef
}

/** Root `playerCareerStats/{playerId}` — rollups from every completed XI (match creator maintains). */
export interface PlayerCareerStatsDoc {
  playerId: string
  /** Denormalised from the latest contributing match roster (best-effort). */
  displayName?: string
  /** Account full name from `users/{uid}` — synced by the player for public career pages. */
  profileFullName?: string
  /** Account display name from profile — synced by the player; distinct from scorecard `displayName`. */
  profileDisplayName?: string
  updatedAt: Timestamp
  /** Last contributing match id (for rules when updating from a completed match). */
  sourceMatchId?: string
  /** When a write comes from “End tournament”, the tournament doc id (for rules). */
  sourceTournamentId?: string
  /** True once any contributing public match or public tournament award was merged (enables unauthenticated read). */
  isPublicAggregate: boolean
  matchesPlayed: number
  potmAwards: number
  pottAwards: number
  runs: number
  balls: number
  /** Career batting innings (batted: ball faced, run scored, or dismissed). */
  battingInnings?: number
  /** Career not-out innings. */
  notOuts?: number
  battingDismissals?: number
  hundreds?: number
  fifties?: number
  battingFours?: number
  battingSixes?: number
  /** Best single-innings score across completed matches. */
  highScore?: number
  wickets: number
  /** Sum of legal balls bowled (derive overs as balls / ballsPerOver on read if needed). */
  bowlingBalls: number
  runsConceded: number
  /** Matches where the player bowled at least one legal ball. */
  bowlingMatches?: number
  /** Bowling innings (per innings bowled in with legal ball or wicket). */
  bowlingInnings?: number
  /** Innings with exactly four wickets. */
  bowlingFourWicketInnings?: number
  /** Innings with five to nine wickets. */
  bowlingFiveWicketInnings?: number
  /** Matches with ten or more wickets in the match for this bowler (both innings combined). */
  bowlingTenWicketMatches?: number
  /** Best single-innings bowling (wickets). Paired with bestBowlingRunsConceded. */
  bestBowlingWickets?: number
  bestBowlingRunsConceded?: number
  fieldingCatches: number
  fieldingRunOuts: number
  fieldingStumpings: number
  /** Matches where the player was their team’s captain. */
  captainMatches?: number
  captainWins?: number
  captainLosses?: number
  captainTies?: number
}

export interface TournamentDoc {
  name: string
  createdBy: string
  isPublic: boolean
  createdAt: Timestamp
  /**
   * Planned squad count (set at creation only). Legacy tournaments may omit this.
   * Use `!= null` before enforcing caps in UI.
   */
  teamCount?: number
  /** Venue / city (optional). */
  location?: string | null
  /** Tournament window (optional on legacy docs). */
  startDate?: Timestamp
  endDate?: Timestamp
  /** Plain text (optional). */
  description?: string
  /** Last used when generating fixtures from linked squads. */
  lastScheduleKind?: TournamentScheduleKind | null
  /** Default XI size for new matches (legacy tournaments may omit). */
  defaultSquadSize?: number
  /** Default overs per innings for new matches. */
  defaultOversLimit?: number
  /** Default max overs per bowler; omit or null = no limit. */
  defaultOversPerBowler?: number | null
  /** Set when the organiser ends the tournament from the overview page. */
  tournamentOutcome?: TournamentOutcome | null
}

/** Persisted when the organiser confirms “End tournament”. */
export interface TournamentOutcome {
  endedAt: Timestamp
  winnerLinkedTeamId: string
  runnerUpLinkedTeamId: string
  playerOfTheTournament: {
    playerId: string
    name: string
    /** Tournament team key (linkedTeams id or home/away style) for display. */
    teamId: string
    source: 'default' | 'manual'
  }
}

/** `tournaments/{tid}/groups/{groupId}` — league phase pool. */
export interface TournamentGroupDoc {
  name: string
  /** `linkedTeams` document ids that play round-robin within this group. */
  linkedTeamIds: string[]
  createdAt: Timestamp
}

/** `tournaments/{tid}/linkedTeams/{linkId}` — tournament references a My team squad. */
export interface TournamentLinkedTeamDoc {
  /** Doc id under `users/{ownerUid}/teams`. */
  userTeamId: string
  /** Denormalized for display; may be stale if the squad is renamed under My teams. */
  teamName?: string
  /** Denormalized squad short code for compact avatars (e.g. tournament team cards). */
  teamShortName?: string
}

export interface TeamDoc {
  name: string
  /** Compact label for lists and tables (e.g. initials). Required for new squads; legacy docs may omit until edited. */
  shortName?: string
  players: RosterPlayer[]
  /** Tournament teams; optional for user squads (set at match start). */
  captainId?: string
  keeperId?: string
  /** Free-text city/region, optional. */
  location?: string | null
  /** Tournament organiser uid; set on create and before tournament delete so rosters stay accessible. */
  organiserUid?: string
  /**
   * Active join-invite token (`userTeamJoinInvites/{token}` doc id). Present invitees may read the squad and append
   * themselves per Firestore rules.
   */
  joinInviteToken?: string | null
  /** Mirror of players[].playerId for rules and membership queries. */
  memberIds?: string[]
  /** Additional roster player uids with co-owner privileges (primary owner is the doc path uid). */
  ownerIds?: string[]
  /** Active ownership transfer (`teamOwnershipTransfers/{id}`) while pending. */
  pendingOwnershipTransferId?: string | null
}

/** `users/{uid}/accessibleSquads/{ownerUid}_{teamId}` — squads the user joined as a player. */
export interface AccessibleSquadDoc {
  ownerUid: string
  teamId: string
  teamName: string
  teamShortName?: string
  role: 'member' | 'co-owner'
}

export type TeamOwnershipTransferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled'

/** `teamOwnershipTransfers/{transferId}` */
export interface TeamOwnershipTransferDoc {
  fromUid: string
  toUid: string
  teamId: string
  teamName: string
  teamShortName?: string
  status: TeamOwnershipTransferStatus
  createdAt: Timestamp
  expiresAt: Timestamp
  resolvedAt?: Timestamp
  teamSnapshot: TeamDoc
  fromDisplayName?: string
  toDisplayName?: string
}

export type OwnershipTransferNotificationKind =
  | 'transfer_sent'
  | 'transfer_received'
  | 'transfer_accepted'
  | 'transfer_rejected'
  | 'transfer_expired'
  | 'transfer_cancelled'

export type TeamCoOwnerNotificationKind =
  | 'co_owner_assigned'
  | 'co_owner_left'
  | 'co_owner_removed'

export type OwnershipTransferNotification = {
  type: 'ownership_transfer'
  kind: OwnershipTransferNotificationKind
  transferId: string
  teamId: string
  teamName: string
  otherUid: string
  otherDisplayName?: string
  /** Who cancelled the transfer (`transfer_cancelled` only). */
  actorUid?: string
  createdAt: Timestamp
  readAt?: Timestamp
}

export type TeamCoOwnerNotification = {
  type: 'team_co_owner'
  kind: TeamCoOwnerNotificationKind
  teamId: string
  teamName: string
  primaryOwnerUid: string
  otherUid: string
  otherDisplayName?: string
  createdAt: Timestamp
  readAt?: Timestamp
}

export type TeamRosterNotificationKind = 'removed_from_team'

export type TeamRosterNotification = {
  type: 'team_roster'
  kind: TeamRosterNotificationKind
  teamId: string
  teamName: string
  primaryOwnerUid: string
  actorUid: string
  actorDisplayName?: string
  createdAt: Timestamp
  readAt?: Timestamp
}

/** `users/{uid}/notifications/{notificationId}` */
export type UserNotificationDoc =
  | OwnershipTransferNotification
  | TeamCoOwnerNotification
  | TeamRosterNotification

/** `userTeamJoinInvites/{token}` — shareable join link metadata (token equals `TeamDoc.joinInviteToken`). */
export interface UserTeamJoinInviteDoc {
  ownerUid: string
  teamId: string
  teamName: string
  createdAt: Timestamp
  /** Denormalized roster ids for UX; invitees append via squad `players` update. */
  memberIds: string[]
}

/** Firestore profile under `users/{uid}` (owner read/write). */
export interface UserProfileDoc {
  /** Legal / passport-style name; required for app access (legacy docs may omit until user saves profile). */
  fullName?: string
  displayName: string
  createdAt?: Timestamp
  /** Exactly 10 digits (no spaces); required for app access; indexed in directory. */
  mobile?: string | null
}

/** Public directory entry for finding registered users when building squads. */
export interface DirectoryUserDoc {
  displayName: string
  displayNameLower: string
  email?: string | null
  emailLower?: string | null
  /** Digits-only normalized phone for prefix search */
  phoneDigits?: string | null
  photoURL?: string | null
  updatedAt?: Timestamp
}

/** Ball outcome; striker/non/bowler at end of delivery are derived by the engine. */
export interface BallEventPayload {
  innings: 1 | 2
  battingSide: Side
  delivery: 'legal' | 'wide' | 'noball'
  runsOffBat: number
  extraWideRuns: number
  extraNoBallRuns: number
  byeRuns: number
  legByeRuns: number
  /**
   * No ball bowled (e.g. retired hurt). Skips legal ball, bowler ball, and striker ball accounting.
   */
  noDelivery?: boolean
  wicket?: {
    dismissedId: string
    howOut: string
    newBatsmanId?: string
    /** Fielding side player involved (catch, run out, stumping); used for stats. */
    fielderId?: string
    /** Denormalized display name (optional; prefer resolving from `fielderId`). */
    fielderName?: string
    /** Default true. False for retired hurt — not a wicket; batter may return later. */
    countsAsWicket?: boolean
  }
}

export interface ScoreEventDoc {
  seq: number
  kind: 'ball' | 'undo' | 'start_second_innings'
  createdAt: Timestamp
  ball?: BallEventPayload
  revertedSeq?: number
  secondInnings?: {
    battingSide: Side
    strikerId: string
    nonStrikerId: string
    bowlerId: string
  }
}

export interface StandingsTeamRow {
  teamId: string
  teamName: string
  played: number
  won: number
  lost: number
  tied: number
  /** No-result / abandoned (1 pt each — same as tied). Omitted on legacy standings docs. */
  nr?: number
  /** League points: 2 per win, 1 per tie or NR (`won×2 + tied + nr`). */
  points: number
  runsFor: number
  oversFor: number
  runsAgainst: number
  oversAgainst: number
  nrr: number
}

export interface StandingsDoc {
  updatedAt: Timestamp
  teams: StandingsTeamRow[]
  /** Denormalized label when doc id is a group id. */
  groupName?: string
}

export interface PlayerAggRow {
  playerId: string
  name: string
  teamId: string
  runs: number
  balls: number
  wickets: number
  oversBowled: number
  runsConceded: number
  /** Wickets involving this player as fielder (catch / run out / stumping assist). */
  fieldingDismissals: number
  mvpScore: number
  /** Aggregates from completed matches (optional on legacy stats docs). */
  fours?: number
  sixes?: number
  /** Highest individual innings total in the tournament for this player. */
  highScore?: number
  /** Batting dismissals (outs) across the tournament. */
  dismissals?: number
  /** Completed matches where this player was stored Player of the Match. */
  potmAwards?: number
  /** Fielding breakdown (same replay rules as MVP). */
  catches?: number
  runOuts?: number
  stumpings?: number
}

export interface StatsDoc {
  updatedAt: Timestamp
  players: PlayerAggRow[]
}
