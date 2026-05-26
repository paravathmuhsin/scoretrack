import type { MatchDoc } from '../types/models'

export type HomeMatchRow = { id: string } & MatchDoc

export function mergeHomeMatchRows(
  publicRows: HomeMatchRow[],
  squadRows: HomeMatchRow[],
  parentRows: HomeMatchRow[],
): HomeMatchRow[] {
  const byId = new Map<string, HomeMatchRow>()
  for (const row of publicRows) {
    if (shouldIncludeInPublicHomeListing(row)) byId.set(row.id, row)
  }
  for (const row of squadRows) {
    if (shouldIncludeInPublicHomeListing(row)) byId.set(row.id, row)
  }
  for (const row of parentRows) {
    if (shouldIncludeInPublicHomeListing(row)) byId.set(row.id, row)
  }
  return [...byId.values()]
}

/** Pending external-team invites stay off the public home listing for everyone. */
export function isExcludedFromPublicHomeListing(match: MatchDoc): boolean {
  const s = match.participantApprovalStatus
  return s === 'pending' || s === 'rejected' || s === 'expired'
}

export function shouldIncludeInPublicHomeListing(match: MatchDoc): boolean {
  return !isExcludedFromPublicHomeListing(match)
}

export function matchApprovedForPublicListing(match: MatchDoc): boolean {
  if (!match.isPublic) return false
  return shouldIncludeInPublicHomeListing(match)
}

/** Public home (`/`) listing — not `/live/:publicId` (live links are open to anyone with the URL). */
export function canViewMatchOnHome(match: MatchDoc, uid: string | undefined): boolean {
  if (isExcludedFromPublicHomeListing(match)) return false
  if (!uid) return matchApprovedForPublicListing(match)
  if (matchApprovedForPublicListing(match)) return true
  if (match.createdBy === uid) return true
  if (match.rosterPlayerIds?.includes(uid)) return true
  if (match.isInternalMatch && match.parentTeamMemberIds?.includes(uid)) return true
  return false
}
