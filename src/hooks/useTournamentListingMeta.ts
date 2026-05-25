import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { getDb } from '../firebase/config'
import { resolveMatchListingMeta } from '../lib/matchListingLabel'
import type { MatchDoc, TournamentDoc } from '../types/models'

/** Tournament name with optional venue: `Name • Location` or `Name`. */
export function formatTournamentListingMeta(t: Pick<TournamentDoc, 'name' | 'location'>): string {
  const name = (t.name || '').trim() || 'Tournament'
  const loc = (t.location || '').trim()
  return loc ? `${name} • ${loc}` : name
}

export type TournamentListingMetaMatch = Pick<
  MatchDoc,
  'tournamentId' | 'tournamentFixtureLabel' | 'isInternalMatch' | 'parentUserTeamRef'
>

/**
 * Public listing header line: tournament name + optional location from Firestore,
 * "Friendly", or "Internal · {parent squad}".
 */
export function useTournamentListingMeta(match: TournamentListingMetaMatch): string {
  const syncLabel = useMemo(
    () => resolveMatchListingMeta(match, null),
    [match.tournamentId, match.tournamentFixtureLabel, match.isInternalMatch, match.parentUserTeamRef],
  )

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

  if (match.tournamentId) return resolved ?? syncLabel
  return syncLabel
}
