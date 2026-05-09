import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Spinner } from '../components/Spinner'
import { getDb } from '../firebase/config'
import { subscribeMatchByPublicId } from '../lib/publicMatchQuery'
import { scoreEventFromFirestore } from '../lib/matchEvents'
import { PublicLiveScorecardDetail } from '../components/PublicLiveScorecardDetail'
import { replayEvents, type ReplayConfig, type ScoreEvent } from '../scoring/engine'
import type { MatchDoc } from '../types/models'

export function PublicLivePage() {
  const { publicId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const [match, setMatch] = useState<(MatchDoc & { id: string }) | null | undefined>(undefined)
  const [events, setEvents] = useState<ScoreEvent[]>([])
  const [listenError, setListenError] = useState<string | null>(null)

  useEffect(() => {
    if (!publicId || authLoading) return
    setListenError(null)
    setMatch(undefined)
    return subscribeMatchByPublicId(
      getDb(),
      publicId,
      { userId: user?.uid },
      {
        onMatch: (m) => {
          setListenError(null)
          setMatch(m)
        },
        onError: (err) => {
          console.error('[PublicLivePage] match listener', err)
          setListenError(err.message || 'Could not load match.')
          setMatch(null)
        },
      },
    )
  }, [publicId, authLoading, user?.uid])

  useEffect(() => {
    if (!match?.id) return
    if (!match.isPublic) {
      queueMicrotask(() => setEvents([]))
      return
    }
    const qy = query(collection(getDb(), 'matches', match.id, 'events'), orderBy('seq', 'asc'))
    return onSnapshot(
      qy,
      (snap) => {
        const out: ScoreEvent[] = []
        snap.forEach((d) => {
          const ev = scoreEventFromFirestore(d.data() as Parameters<typeof scoreEventFromFirestore>[0])
          if (ev) out.push(ev)
        })
        setEvents(out)
      },
      (err) => {
        console.error('[PublicLivePage] events listener', err)
        setEvents([])
      },
    )
  }, [match?.id, match?.isPublic])

  const cfg: ReplayConfig | null = useMemo(() => {
    if (!match?.lineup) return null
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

  if (publicId === undefined) return <p>Missing id</p>

  if (authLoading || match === undefined) {
    return (
      <div className="public public--live-wide public-live-page">
        <div className="public-live-page-loading" role="status" aria-live="polite" aria-busy="true">
          <Spinner size="md" />
          <span>Loading scorecard…</span>
        </div>
      </div>
    )
  }

  if (listenError) {
    return (
      <div className="public public--live-wide public-live-page">
        <p className="error">{listenError}</p>
        <p className="muted small">
          If you are not signed in, only <strong>public</strong> matches can be opened from this link. Match owners can
          sign in to view a private match.
        </p>
      </div>
    )
  }

  if (match === null)
    return (
      <div className="public public--live-wide public-live-page">
        <p>Match not found.</p>
      </div>
    )
  if (!match.isPublic)
    return (
      <div className="public public--live-wide public-live-page">
        <p>This match is not public.</p>
      </div>
    )

  return (
    <div className="public public--live-wide public-live-page">
      {match && (
        <h1 className="public-live-sr">
          {match.home.name} vs {match.away.name}
        </h1>
      )}
      {cfg && state && (
        <PublicLiveScorecardDetail match={match} cfg={cfg} state={state} events={events} />
      )}
      {!match.lineup && <p className="muted">Match not started yet.</p>}
    </div>
  )
}
