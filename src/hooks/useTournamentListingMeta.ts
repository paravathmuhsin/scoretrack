import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { getDb } from '../firebase/config'
import type { MatchDoc, TournamentDoc } from '../types/models'

/** Tournament name with optional venue: `Name • Location` or `Name`. */
export function formatTournamentListingMeta(t: Pick<TournamentDoc, 'name' | 'location'>): string {
  const name = (t.name || '').trim() || 'Tournament'
  const loc = (t.location || '').trim()
  return loc ? `${name} • ${loc}` : name
}

/**
 * Public listing header line: tournament name + optional location from Firestore,
 * or "Friendly" when the match is not tied to a tournament.
 */
export function useTournamentListingMeta(
  match: Pick<MatchDoc, 'tournamentId' | 'tournamentFixtureLabel'>,
): string {
  const syncLabel = useMemo(() => {
    if (!match.tournamentId) return 'Friendly'
    return match.tournamentFixtureLabel?.trim() ?? ''
  }, [match.tournamentId, match.tournamentFixtureLabel])

  const [resolved, setResolved] = useState<string | null>(null)

  useEffect(() => {
    if (!match.tournamentId) {
      setResolved(null)
      return
    }

    const interim = match.tournamentFixtureLabel?.trim() ?? ''
    const tournamentId = match.tournamentId
    setResolved(null)
    let cancelled = false

    void (async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'tournaments', tournamentId))
        if (cancelled) return
        if (!snap.exists()) {
          setResolved(interim || 'Tournament')
          return
        }
        setResolved(formatTournamentListingMeta(snap.data() as TournamentDoc))
      } catch {
        if (!cancelled) setResolved(interim || 'Tournament')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [match.tournamentId, match.tournamentFixtureLabel])

  if (!match.tournamentId) return 'Friendly'
  return resolved ?? syncLabel
}
