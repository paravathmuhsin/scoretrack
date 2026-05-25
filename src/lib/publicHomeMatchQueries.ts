import type { MatchDoc } from '../types/models'

export type HomeMatchRow = { id: string } & MatchDoc

export function mergeHomeMatchRows(
  publicRows: HomeMatchRow[],
  squadRows: HomeMatchRow[],
  parentRows: HomeMatchRow[],
): HomeMatchRow[] {
  const byId = new Map<string, HomeMatchRow>()
  for (const row of publicRows) byId.set(row.id, row)
  for (const row of squadRows) byId.set(row.id, row)
  for (const row of parentRows) byId.set(row.id, row)
  return [...byId.values()]
}

/** Public home (`/`) listing — not `/live/:publicId` (live links are open to anyone with the URL). */
export function canViewMatchOnHome(match: MatchDoc, uid: string | undefined): boolean {
  if (!uid) return match.isPublic === true
  if (match.isPublic) return true
  if (match.createdBy === uid) return true
  if (match.rosterPlayerIds?.includes(uid)) return true
  if (match.isInternalMatch && match.parentTeamMemberIds?.includes(uid)) return true
  return false
}
