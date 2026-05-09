/** Grid for squad pick tiles in the modal. */
export const SQUAD_TILE_GRID_CLASS = 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3'

/** Flex wrap: each squad summary chip is width: fit-content (see SquadSummaryTile). */
export const SQUAD_SUMMARY_TILE_LIST_CLASS = 'flex flex-wrap gap-2'

export function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const w = parts[0] ?? ''
  return w.slice(0, 2).toUpperCase() || '?'
}
