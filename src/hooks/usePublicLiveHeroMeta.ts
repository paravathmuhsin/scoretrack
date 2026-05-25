import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { getDb } from '../firebase/config'
import { resolvePublicLiveHeroLine } from '../lib/matchListingLabel'
import { formatTournamentListingMeta } from './useTournamentListingMeta'
import type { MatchDoc, TournamentDoc } from '../types/models'

export type PublicLiveHeroMetaMatch = Pick<
  MatchDoc,
  'tournamentId' | 'tournamentFixtureLabel' | 'venue' | 'isInternalMatch' | 'parentUserTeamRef'
>

/**
 * Secondary line for public `/live/:id`: tournament name · fixture label,
 * or `Friendly` / `Internal · {parent team}` with optional venue.
 */
export function usePublicLiveHeroMeta(match: PublicLiveHeroMetaMatch): string {
  const [line, setLine] = useState(() => resolvePublicLiveHeroLine(match))

  useEffect(() => {
    if (match.tournamentId) return
    setLine(resolvePublicLiveHeroLine(match))
  }, [match.tournamentId, match.venue, match.isInternalMatch, match.parentUserTeamRef])

  useEffect(() => {
    const tid = match.tournamentId
    if (!tid) return

    let cancelled = false
    void (async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'tournaments', tid))
        if (cancelled) return
        if (!snap.exists()) {
          const fl = match.tournamentFixtureLabel?.trim()
          setLine(fl || 'Tournament')
          return
        }
        const t = snap.data() as TournamentDoc
        let l = formatTournamentListingMeta(t)
        const fl = match.tournamentFixtureLabel?.trim()
        if (fl) l += ` · ${fl}`
        setLine(l)
      } catch {
        if (!cancelled) {
          const fl = match.tournamentFixtureLabel?.trim()
          setLine(fl || 'Tournament')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [match.tournamentId, match.tournamentFixtureLabel])

  return line
}
