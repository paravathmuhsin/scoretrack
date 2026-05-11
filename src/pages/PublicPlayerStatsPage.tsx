import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { PlayerCareerStatCards } from '../components/PlayerCareerStatCards'
import { Spinner } from '../components/Spinner'
import { getDb } from '../firebase/config'
import { syncPlayerCareerProfileNames } from '../lib/syncPlayerCareerProfileNames'
import type { DirectoryUserDoc, PlayerCareerStatsDoc, UserProfileDoc } from '../types/models'
import { cn } from '@/lib/utils'

/** Career profile for a roster `playerId` (aggregates from every completed XI they played). */
export function PublicPlayerStatsPage() {
  const { playerId } = useParams<{ playerId: string }>()
  const { user } = useAuth()
  const [career, setCareer] = useState<PlayerCareerStatsDoc | null | undefined>(undefined)
  const [careerError, setCareerError] = useState<string | null>(null)
  const [directoryDisplayName, setDirectoryDisplayName] = useState<string | null>(null)
  /** When viewing `/player/:yourUid`, profile fields for full / display name. */
  const [ownerProfile, setOwnerProfile] = useState<UserProfileDoc | null | undefined>(undefined)

  const isOwnerView = Boolean(user && playerId && user.uid === playerId)

  useEffect(() => {
    if (!playerId) {
      setCareer(undefined)
      return
    }
    setCareerError(null)
    setCareer(undefined)
    const cref = doc(getDb(), 'playerCareerStats', playerId)
    return onSnapshot(
      cref,
      (snap) => {
        setCareerError(null)
        setCareer(snap.exists() ? (snap.data() as PlayerCareerStatsDoc) : null)
      },
      (err) => {
        console.error('[PublicPlayerStatsPage] playerCareerStats', err)
        setCareerError(err.message || 'Could not load player stats.')
        setCareer(null)
      },
    )
  }, [playerId])

  useEffect(() => {
    if (!user || !playerId) {
      setDirectoryDisplayName(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'directoryUsers', playerId))
        if (cancelled) return
        if (!snap.exists()) {
          setDirectoryDisplayName(null)
          return
        }
        const d = snap.data() as DirectoryUserDoc
        setDirectoryDisplayName(d.displayName?.trim() || null)
      } catch {
        if (!cancelled) setDirectoryDisplayName(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, playerId])

  useEffect(() => {
    if (!isOwnerView || !playerId) {
      setOwnerProfile(undefined)
      return
    }
    let cancelled = false
    setOwnerProfile(undefined)
    void (async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'users', playerId))
        if (cancelled) return
        setOwnerProfile(snap.exists() ? (snap.data() as UserProfileDoc) : null)
      } catch {
        if (!cancelled) setOwnerProfile(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOwnerView, playerId])

  /** Mirror `users/{uid}` names onto career so anonymous viewers can read them (rules block `users` except self). */
  useEffect(() => {
    if (!isOwnerView || !playerId || !user || ownerProfile === undefined) return
    if (career === undefined) return
    const fn = ownerProfile?.fullName?.trim() ?? ''
    const dn = ownerProfile?.displayName?.trim() || user.displayName?.trim() || ''
    if (!fn) return
    const careerFn = career?.profileFullName?.trim() ?? ''
    const careerDn = career?.profileDisplayName?.trim() ?? ''
    const mismatch = careerFn !== fn || (dn || '') !== (careerDn || '')
    if (!mismatch) return
    let cancelled = false
    void (async () => {
      try {
        await syncPlayerCareerProfileNames(getDb(), playerId, fn, dn)
      } catch (e) {
        if (!cancelled) console.warn('[PublicPlayerStatsPage] career profile name sync', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOwnerView, playerId, user, ownerProfile, career])

  const { nameBlockLoading, nameLine1, nameLine2 } = useMemo(() => {
    if (!playerId) {
      return {
        nameBlockLoading: false,
        nameLine1: '—',
        nameLine2: null as string | null,
      }
    }

    const fromCareerFn = career?.profileFullName?.trim() ?? ''
    const fromCareerDn = career?.profileDisplayName?.trim() ?? ''
    const roster = career?.displayName?.trim() ?? ''
    const dir = directoryDisplayName?.trim() ?? ''

    /** Own page: wait for `users/{uid}` so we can show Profile full name; guests use career mirror only. */
    const nameBlockLoading = isOwnerView && ownerProfile === undefined

    /**
     * Your URL: full name from `users/{uid}.fullName` (canonical).
     * Anyone else (including logged out): `playerCareerStats.profileFullName` (mirrored from profile — required because Firestore blocks reading others’ `users` docs).
     */
    const fullName =
      isOwnerView && ownerProfile !== undefined
        ? ownerProfile?.fullName?.trim() || '—'
        : fromCareerFn || '—'
    let displayName = ''
    if (isOwnerView && ownerProfile !== undefined) {
      displayName = ownerProfile?.displayName?.trim() || user?.displayName?.trim() || ''
    }
    if (!displayName) displayName = fromCareerDn || dir || roster || ''
    if (!displayName) displayName = '—'

    /** Same layout as `/app/my-stats`: primary line + `(display)` only when both exist and differ (case-insensitive). */
    const fn = fullName !== '—' ? fullName.trim() : ''
    const dn = displayName !== '—' ? displayName.trim() : ''
    const nameLine1 = fn || dn || '—'
    const nameLine2 =
      fn && dn && dn.toLowerCase() !== fn.toLowerCase()
        ? `(${dn})`
        : null

    return {
      nameBlockLoading,
      nameLine1,
      nameLine2,
    }
  }, [
    playerId,
    career,
    isOwnerView,
    ownerProfile,
    user,
    directoryDisplayName,
  ])

  useEffect(() => {
    const label = nameLine1 !== '—' ? nameLine1 : 'Player'
    document.title = `${label} · Career stats · ScoreTrack`
  }, [nameLine1])

  if (!playerId) {
    return (
      <div className="public public--live-wide public-live-page">
        <p className="muted">Missing player id in URL.</p>
      </div>
    )
  }

  return (
    <div className="public public--live-wide public-live-page">
      <div className="mx-auto w-full max-w-xl space-y-5 pb-2">
        <p className="mb-0">
          <Link
            to="/"
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-semibold no-underline hover:underline',
              '!text-primary hover:!text-primary visited:!text-primary',
            )}
          >
            <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
            Matches
          </Link>
        </p>

        <header className="mt-4 space-y-1.5">
          <div className="min-w-0">
            {nameBlockLoading ? (
              <div
                className="flex items-center justify-center gap-2 text-center text-sm text-slate-500"
                role="status"
                aria-live="polite"
              >
                <Spinner size="sm" />
                <span>Loading profile…</span>
              </div>
            ) : (
              <div className="space-y-1 text-center">
                <h1 className="mb-0 text-2xl font-bold leading-tight tracking-tight text-slate-900 text-balance">
                  {nameLine1}
                </h1>
                {nameLine2 != null ? (
                  <p className="mb-0 text-[0.95rem] font-normal text-slate-500 text-balance">{nameLine2}</p>
                ) : null}
              </div>
            )}
          </div>
        </header>

        {careerError && (
          <p className="text-sm text-red-600" role="alert">
            {careerError}
          </p>
        )}

        <PlayerCareerStatCards career={career === undefined ? null : career} layout="app" />
      </div>
    </div>
  )
}
