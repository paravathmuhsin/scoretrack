import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { getDb } from '../firebase/config'
import { formatTournamentListingMeta } from './useTournamentListingMeta'
import type { MatchDoc, TournamentDoc } from '../types/models'

/**
 * Secondary line for public `/live/:id`: tournament name · venue · fixture label from Firestore,
 * or `Friendly` with optional match {@link MatchDoc.venue}.
 */
export function usePublicLiveHeroMeta(
  match: Pick<MatchDoc, 'tournamentId' | 'tournamentFixtureLabel' | 'venue'>,
): string {
  const [line, setLine] = useState(() => initialLine(match))

  useEffect(() => {
    if (match.tournamentId) return
    const v = (match.venue ?? '').trim()
    setLine(v ? `Friendly · ${v}` : 'Friendly')
  }, [match.tournamentId, match.venue])

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

function initialLine(match: Pick<MatchDoc, 'tournamentId' | 'tournamentFixtureLabel' | 'venue'>): string {
  if (!match.tournamentId) {
    const v = (match.venue ?? '').trim()
    return v ? `Friendly · ${v}` : 'Friendly'
  }
  return match.tournamentFixtureLabel?.trim() || 'Tournament'
}
