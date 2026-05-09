import { getPlayerRoles } from '../lib/matchPlayerRoles'
import type { MatchDoc, Side } from '../types/models'

type Props = {
  match: MatchDoc
  side: Side
  playerId: string
}

/** Cricket-style captain / wicket-keeper markers next to a player name. */
export function PlayerRoleMarkers({ match, side, playerId }: Props) {
  const { captain, keeper } = getPlayerRoles(match, side, playerId)
  if (!captain && !keeper) return null
  const label = [captain && 'Captain', keeper && 'Wicket-keeper'].filter(Boolean).join(', ')
  return (
    <span className="player-role-markers muted small" aria-label={label}>
      {captain && (
        <abbr className="player-role-marker" title="Captain">
          (c)
        </abbr>
      )}
      {captain && keeper ? <span aria-hidden> </span> : null}
      {keeper && (
        <abbr className="player-role-marker" title="Wicket-keeper">
          (wk)
        </abbr>
      )}
    </span>
  )
}

type DraftProps = {
  playerId: string
  captainId?: string
  keeperId?: string
}

/** Roles before match lineup is saved (start-match form). */
export function DraftPlayerRoleMarkers({ playerId, captainId, keeperId }: DraftProps) {
  const captain = Boolean(captainId && captainId === playerId)
  const keeper = Boolean(keeperId && keeperId === playerId)
  if (!captain && !keeper) return null
  const label = [captain && 'Captain', keeper && 'Wicket-keeper'].filter(Boolean).join(', ')
  return (
    <span className="player-role-markers muted small" aria-label={label}>
      {captain && (
        <abbr className="player-role-marker" title="Captain">
          (c)
        </abbr>
      )}
      {captain && keeper ? <span aria-hidden> </span> : null}
      {keeper && (
        <abbr className="player-role-marker" title="Wicket-keeper">
          (wk)
        </abbr>
      )}
    </span>
  )
}
