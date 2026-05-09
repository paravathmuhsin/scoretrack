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
  scheduledAt: Timestamp
  status: MatchStatus
  createdBy: string
  isPublic: boolean
  publicId: string
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
}

/** Firestore profile under `users/{uid}` (owner read/write). */
export interface UserProfileDoc {
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
}

export interface StatsDoc {
  updatedAt: Timestamp
  players: PlayerAggRow[]
}
