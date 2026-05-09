import type { MatchDoc, Side } from '../types/models'

export function sideForPlayer(match: MatchDoc, playerId: string): Side | null {
  if (match.home.players.some((p) => p.playerId === playerId)) return 'home'
  if (match.away.players.some((p) => p.playerId === playerId)) return 'away'
  return null
}

export function getPlayerRoles(
  match: MatchDoc,
  side: Side,
  playerId: string,
): { captain: boolean; keeper: boolean } {
  const lu = match.lineup
  if (!lu) return { captain: false, keeper: false }
  const cap = side === 'home' ? lu.homeCaptainId : lu.awayCaptainId
  const wk = side === 'home' ? lu.homeKeeperId : lu.awayKeeperId
  return { captain: cap === playerId, keeper: wk === playerId }
}

/** Plain suffix for PDF / text: " (c)", " (wk)", or " (c) (wk)" */
export function playerRoleMarkersPlain(match: MatchDoc, side: Side, playerId: string): string {
  const { captain, keeper } = getPlayerRoles(match, side, playerId)
  const parts: string[] = []
  if (captain) parts.push('(c)')
  if (keeper) parts.push('(wk)')
  return parts.length ? ` ${parts.join(' ')}` : ''
}
