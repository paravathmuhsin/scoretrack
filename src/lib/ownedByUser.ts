import type { MatchDoc, TeamDoc, TournamentDoc } from '../types/models'

/**
 * Ownership filters for signed-in `/app/**` screens only (**My matches**, **My tournaments**, **My teams**).
 *
 * Do **not** use this on public routes (`PublicMatchesPage`, `PublicTournamentsPage`, `/live/:id`, …).
 * Those lists use `isPublic` (and related) queries and intentionally show every creator’s public content.
 */

/** Matches / tournaments you created (owner id on the document). */
export function isCreatedByUser(createdBy: string | undefined, uid: string): boolean {
  return typeof createdBy === 'string' && createdBy.length > 0 && createdBy === uid
}

export function filterMatchesCreatedByUser<T extends Pick<MatchDoc, 'createdBy'>>(rows: T[], uid: string): T[] {
  return rows.filter((r) => isCreatedByUser(r.createdBy, uid))
}

export function filterTournamentsCreatedByUser<T extends Pick<TournamentDoc, 'createdBy'>>(rows: T[], uid: string): T[] {
  return rows.filter((r) => isCreatedByUser(r.createdBy, uid))
}

/**
 * My squads live under `users/{uid}/teams`. If a doc ever had `organiserUid` backfilled to another user
 * (should not happen on that path), hide it from this list.
 */
export function filterMyTeamsDocPath<T extends TeamDoc & { id: string }>(rows: T[], uid: string): T[] {
  return rows.filter((t) => !t.organiserUid || t.organiserUid === uid)
}
