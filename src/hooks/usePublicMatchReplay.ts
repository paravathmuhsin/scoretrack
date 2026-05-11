import { collection, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { getDb } from '../firebase/config'
import { scoreEventFromFirestore } from '../lib/matchEvents'
import { replayEvents, type ReplayConfig, type ScoreEvent } from '../scoring/engine'
import type { MatchDoc } from '../types/models'

type MatchReplayInput = {
  id: string
} & Pick<
  MatchDoc,
  | 'isPublic'
  | 'lineup'
  | 'squadSize'
  | 'oversLimit'
  | 'ballsPerOver'
  | 'oversPerBowler'
  | 'home'
  | 'away'
>

/**
 * Loads ball-by-ball events and replays them — same source as {@link LiveMatchListCard}.
 * No network work when `replayMode` is `'off'` or the match is not public.
 */
export function usePublicMatchReplay(
  match: MatchReplayInput,
  replayMode: 'live' | 'completed' | 'off',
): { cfg: ReplayConfig | null; state: ReturnType<typeof replayEvents> | null } {
  const [events, setEvents] = useState<ScoreEvent[]>([])

  useEffect(() => {
    if (replayMode === 'off' || !match.id || !match.isPublic) {
      setEvents([])
      return
    }
    const coll = collection(getDb(), 'matches', match.id, 'events')
    const qy = query(coll, orderBy('seq', 'asc'))

    if (replayMode === 'completed') {
      let cancelled = false
      void (async () => {
        try {
          const snap = await getDocs(qy)
          if (cancelled) return
          const out: ScoreEvent[] = []
          snap.forEach((d) => {
            const ev = scoreEventFromFirestore(d.data() as Parameters<typeof scoreEventFromFirestore>[0])
            if (ev) out.push(ev)
          })
          setEvents(out)
        } catch (e) {
          console.error('[usePublicMatchReplay completed]', e)
          if (!cancelled) setEvents([])
        }
      })()
      return () => {
        cancelled = true
      }
    }

    return onSnapshot(qy, (snap) => {
      const out: ScoreEvent[] = []
      snap.forEach((d) => {
        const ev = scoreEventFromFirestore(d.data() as Parameters<typeof scoreEventFromFirestore>[0])
        if (ev) out.push(ev)
      })
      setEvents(out)
    })
  }, [match.id, match.isPublic, replayMode])

  const cfg: ReplayConfig | null = useMemo(() => {
    if (!match.lineup) return null
    return {
      squadSize: match.squadSize,
      oversLimit: match.oversLimit,
      ballsPerOver: match.ballsPerOver ?? 6,
      oversPerBowler: match.oversPerBowler ?? null,
      lineup: match.lineup,
      homeName: match.home.name,
      awayName: match.away.name,
    }
  }, [match])

  const state = useMemo(() => {
    if (!cfg) return null
    return replayEvents(cfg, events)
  }, [cfg, events])

  return { cfg, state }
}
