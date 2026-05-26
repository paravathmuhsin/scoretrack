import type { RosterPlayer } from '../types/models'

/** Firebase Auth uids are not UUID v4 roster placeholders. */
export function isLikelyRegisteredUserId(playerId: string): boolean {
  const id = playerId.trim()
  if (!id) return false
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return false
  }
  return id.length >= 20
}

export function normalizeOwnerIds(
  ownerIds: string[],
  players: RosterPlayer[],
  primaryUid: string,
): string[] {
  const playerSet = new Set(players.map((p) => p.playerId))
  const out = new Set<string>()
  for (const id of ownerIds) {
    if (!id || id === primaryUid) continue
    if (!playerSet.has(id)) continue
    if (!isLikelyRegisteredUserId(id)) continue
    out.add(id)
  }
  return [...out]
}

/**
 * Restore protected roster rows on save.
 * Primary owner: pass `ownerIds: []` so only `primaryUid` is protected.
 * Co-owner: pass full `ownerIds` so primary and co-owners cannot be dropped.
 */
export function mergeProtectedRosterForCoOwnerSave(
  submitted: RosterPlayer[],
  original: RosterPlayer[],
  primaryUid: string,
  ownerIds: string[],
): RosterPlayer[] {
  const protectedIds = new Set([primaryUid, ...ownerIds])
  const submittedById = new Map(submitted.map((p) => [p.playerId, p]))
  const result: RosterPlayer[] = []
  for (const op of original) {
    if (protectedIds.has(op.playerId)) {
      result.push(submittedById.get(op.playerId) ?? op)
    }
  }
  for (const sp of submitted) {
    if (!protectedIds.has(sp.playerId) && !result.some((r) => r.playerId === sp.playerId)) {
      result.push(sp)
    }
  }
  return result
}
