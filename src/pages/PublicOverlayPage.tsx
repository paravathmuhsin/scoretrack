import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { ObsBattingScorecard } from '../components/ObsBattingScorecard'
import { ObsBowlingScorecard } from '../components/ObsBowlingScorecard'
import { ObsMatchSummaryCard } from '../components/ObsMatchSummaryCard'
import { ObsScoreBar } from '../components/ObsScoreBar'
import { getDb } from '../firebase/config'
import { scoreEventFromFirestore } from '../lib/matchEvents'
import { resolveEffectiveOverlayPrimary } from '../lib/overlayPrimary'
import { subscribeMatchByPublicId } from '../lib/publicMatchQuery'
import { replayEvents, type ReplayConfig, type ScoreEvent } from '../scoring/engine'
import type { MatchDoc } from '../types/models'

/**
 * Wraps overlay output: no app chrome, transparent document background, fixed 1920×1080 canvas (standard OBS browser source size).
 */
function ObsChrome({ children }: { children?: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.obsOverlay = 'true'
    return () => {
      delete document.documentElement.dataset.obsOverlay
    }
  }, [])
  return (
    <div className="obs-overlay-page">
      <div className="obs-overlay-canvas">{children}</div>
    </div>
  )
}

export function PublicOverlayPage() {
  const { publicId } = useParams()
  const [match, setMatch] = useState<(MatchDoc & { id: string }) | null | undefined>(undefined)
  const [events, setEvents] = useState<ScoreEvent[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 400)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!publicId) return
    setMatch(undefined)
    return subscribeMatchByPublicId(getDb(), publicId, {
      onMatch: (m) => setMatch(m),
      onError: () => setMatch(null),
    })
  }, [publicId])

  useEffect(() => {
    if (!match?.id || !match.lineup) return
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
      () => {
        setEvents([])
      },
    )
  }, [match?.id, match?.lineup])

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

  const showBar =
    match &&
    cfg &&
    state &&
    match.lineup &&
    (match.status === 'live' || match.status === 'completed' || match.status === 'abandoned')

  const effectivePrimary = useMemo(() => {
    if (!match || !cfg || !state) return 'none' as const
    return resolveEffectiveOverlayPrimary(match, cfg, state, nowMs)
  }, [match, cfg, state, nowMs])

  const showPrimaryPanel = effectivePrimary !== 'none'
  /** Score bar is the sole primary when no large card is shown; hide it while batting/bowling/summary. */
  const showScoreBar = showBar && !showPrimaryPanel
  const summaryAsPreview = effectivePrimary === 'summary' && !state?.matchComplete

  return (
    <ObsChrome>
      {showBar && match && cfg && state ? (
        <div
          className={[
            'obs-overlay-stack',
            showPrimaryPanel ? 'obs-overlay-stack--primary-only' : 'obs-overlay-stack--scorebar-only',
          ].join(' ')}
        >
          {showPrimaryPanel ? (
            <div className="obs-overlay-main">
              <div className="obs-overlay-scorecard-panel">
                <div className="obs-overlay-card-slot" role="region" aria-label="Primary overlay">
                  {effectivePrimary === 'batting' ? (
                    <ObsBattingScorecard match={match} cfg={cfg} state={state} events={events} />
                  ) : null}
                  {effectivePrimary === 'bowling' ? (
                    <ObsBowlingScorecard match={match} cfg={cfg} state={state} events={events} />
                  ) : null}
                  {effectivePrimary === 'summary' ? (
                    <ObsMatchSummaryCard
                      match={match}
                      cfg={cfg}
                      state={state}
                      previewPlaceholder={summaryAsPreview}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          {showScoreBar ? (
            <ObsScoreBar match={match} cfg={cfg} state={state} events={events} />
          ) : null}
        </div>
      ) : null}
    </ObsChrome>
  )
}
