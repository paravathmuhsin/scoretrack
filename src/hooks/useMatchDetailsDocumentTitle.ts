import { doc, getDoc } from 'firebase/firestore'
import { useEffect } from 'react'
import { getDb } from '../firebase/config'
import type { MatchDoc, TournamentDoc } from '../types/models'

export const SCORETRACK_DEFAULT_DOCUMENT_TITLE = 'ScoreTrack — live scores'

function formatMatchDetailsTitle(homeName: string, awayName: string, location: string): string {
  const a = homeName.trim() || 'Home'
  const b = awayName.trim() || 'Away'
  const loc = location.trim()
  return loc ? `${a} vs ${b} - ${loc}` : `${a} vs ${b}`
}

/**
 * Sets `document.title` to `Team A vs Team B - Location` while the route is active.
 * `undefined` = still loading (title unchanged). `null` = no match (reset to default).
 * Location: {@link MatchDoc.venue} for friendlies, else `tournaments/{id}.location`.
 */
export function useMatchDetailsDocumentTitle(match: (MatchDoc & { id: string }) | null | undefined): void {
  const titleDeps =
    match === undefined
      ? '__loading__'
      : match === null
        ? '__null__'
        : [match.id, match.home.name, match.away.name, match.tournamentId ?? '', match.venue ?? ''].join('\u0001')

  useEffect(() => {
    return () => {
      document.title = SCORETRACK_DEFAULT_DOCUMENT_TITLE
    }
  }, [])

  useEffect(() => {
    if (match === undefined) return

    if (match === null) {
      document.title = SCORETRACK_DEFAULT_DOCUMENT_TITLE
      return
    }

    const apply = (location: string) => {
      document.title = formatMatchDetailsTitle(match.home.name, match.away.name, location)
    }

    if (!match.tournamentId) {
      apply(match.venue ?? '')
      return
    }

    const tid = match.tournamentId
    let cancelled = false
    void (async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'tournaments', tid))
        if (cancelled) return
        const loc = snap.exists() ? ((snap.data() as TournamentDoc).location ?? '').trim() : ''
        apply(loc)
      } catch {
        if (!cancelled) apply('')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [titleDeps]) // eslint-disable-line react-hooks/exhaustive-deps -- `titleDeps` only; full `match` updates every Firestore tick
}
