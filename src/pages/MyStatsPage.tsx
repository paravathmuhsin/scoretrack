import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { ArrowLeft, LogIn } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { PlayerCareerStatCards } from '../components/PlayerCareerStatCards'
import { Spinner } from '../components/Spinner'
import { buttonVariants } from '../components/ui/button'
import { getDb } from '../firebase/config'
import { withRedirectQuery } from '../lib/safeRedirect'
import type { PlayerCareerStatsDoc, UserProfileDoc } from '../types/models'
import { cn } from '@/lib/utils'

/**
 * Hub for personal stats. Career aggregates for your roster id live at `/player/:playerId`
 * (same document as `/player/:playerId` when that id is you).
 */
export function MyStatsPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfileDoc | null | undefined>(undefined)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [career, setCareer] = useState<PlayerCareerStatsDoc | null | undefined>(undefined)
  const [careerError, setCareerError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setProfile(undefined)
      return
    }
    let cancelled = false
    setProfile(undefined)
    setProfileError(null)
    void (async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'users', user.uid))
        if (cancelled) return
        setProfile(snap.exists() ? (snap.data() as UserProfileDoc) : null)
      } catch (e) {
        if (cancelled) return
        setProfileError(e instanceof Error ? e.message : 'Could not load profile.')
        setProfile(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setCareer(undefined)
      return
    }
    setCareerError(null)
    const cref = doc(getDb(), 'playerCareerStats', user.uid)
    return onSnapshot(
      cref,
      (snap) => {
        setCareerError(null)
        setCareer(snap.exists() ? (snap.data() as PlayerCareerStatsDoc) : null)
      },
      (err) => {
        console.error('[MyStatsPage] playerCareerStats', err)
        setCareerError(err.message || 'Could not load career stats.')
        setCareer(null)
      },
    )
  }, [user])

  /** First row: full name (or display if no full name). Second row: `(display)` whenever a display name exists and the first line is the full name. */
  const { nameLine1, nameLine2, titleForDoc } = useMemo(() => {
    if (!user) return { nameLine1: '', nameLine2: null as string | null, titleForDoc: 'My stats' }
    if (profile === undefined) return { nameLine1: '', nameLine2: null, titleForDoc: 'My stats' }
    const fn = profile?.fullName?.trim() ?? ''
    const dn =
      profile?.displayName?.trim() ||
      user.displayName?.trim() ||
      user.email?.split('@')[0] ||
      ''
    const line1 = fn || dn || '—'
    const line2 =
      fn && dn
        ? dn.toLowerCase() === fn.toLowerCase()
          ? null
          : `(${dn})`
        : null
    const titleForDoc = line1 !== '—' ? line1 : dn || 'My stats'
    return { nameLine1: line1, nameLine2: line2, titleForDoc }
  }, [user, profile])

  useEffect(() => {
    if (!user) {
      document.title = 'My stats · ScoreTrack'
      return
    }
    if (nameLine1 === '') {
      document.title = 'My stats · ScoreTrack'
      return
    }
    document.title = `${titleForDoc} · My stats · ScoreTrack`
  }, [user, nameLine1, titleForDoc])

  if (!user) {
    const loginHref = withRedirectQuery('/login', '/app/my-stats')
    return (
      <div className="mx-auto w-full max-w-xl space-y-6 pb-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-100 bg-white/80 px-6 py-5">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Sign in to view your career</h1>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Batting, bowling, and match totals are tied to your account. Sign in with Google or email to see your
              numbers here.
            </p>
          </div>
          <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <Link
              to={loginHref}
              className={cn(
                buttonVariants({ variant: 'default', size: 'lg' }),
                'w-full gap-2 no-underline sm:w-auto',
              )}
            >
              <LogIn className="size-4 shrink-0" aria-hidden />
              Sign in
            </Link>
            <p className="text-center text-sm text-slate-500 sm:text-left">
              New here?{' '}
              <Link
                to={withRedirectQuery('/register', '/app/my-stats')}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const profileReady = profile !== undefined

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 pb-2">
      <p className="mb-0">
        <Link
          to="/app/profile"
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-semibold no-underline hover:underline',
            '!text-primary hover:!text-primary visited:!text-primary',
          )}
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
          Profile
        </Link>
      </p>

      <header className="mt-4 space-y-1.5">
        <div className="min-w-0">
          {!profileReady ? (
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
        {profileError && (
          <p className="text-sm text-red-600" role="alert">
            {profileError}
          </p>
        )}
      </header>

      {careerError && (
        <p className="text-sm text-red-600" role="alert">
          {careerError}
        </p>
      )}

      <PlayerCareerStatCards career={career === undefined ? null : career} layout="app" />
    </div>
  )
}
