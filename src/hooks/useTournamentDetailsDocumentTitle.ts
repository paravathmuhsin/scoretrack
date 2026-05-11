import { useEffect } from 'react'
import { SCORETRACK_DEFAULT_DOCUMENT_TITLE } from './useMatchDetailsDocumentTitle'
import type { TournamentDoc } from '../types/models'

function formatTournamentDetailsTitle(name: string, location: string): string {
  const n = name.trim() || 'Tournament'
  const loc = location.trim()
  return loc ? `${n} - ${loc}` : n
}

/**
 * Sets `document.title` to `Tournament name - Location` while the route is active.
 * `null` = not loaded or missing (reset to default).
 */
export function useTournamentDetailsDocumentTitle(
  tournament: (TournamentDoc & { id: string }) | null,
): void {
  const titleDeps =
    tournament === null
      ? '__null__'
      : [tournament.id, tournament.name, tournament.location ?? ''].join('\u0001')

  useEffect(() => {
    return () => {
      document.title = SCORETRACK_DEFAULT_DOCUMENT_TITLE
    }
  }, [])

  useEffect(() => {
    if (tournament === null) {
      document.title = SCORETRACK_DEFAULT_DOCUMENT_TITLE
      return
    }
    document.title = formatTournamentDetailsTitle(tournament.name, tournament.location ?? '')
  }, [titleDeps]) // eslint-disable-line react-hooks/exhaustive-deps -- `titleDeps` only; full `tournament` updates every Firestore tick
}
