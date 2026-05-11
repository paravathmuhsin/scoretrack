import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/useAuth'
import { getDb } from '../firebase/config'
import { isProfileComplete } from '../lib/profileComplete'
import type { TeamDoc, UserProfileDoc, UserTeamJoinInviteDoc } from '../types/models'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Override global `a { color: #2563eb }` when `<Link>` uses primary button styling. */
const PRIMARY_LINK_BTN_TEXT =
  '!text-white hover:!text-white visited:!text-white no-underline hover:no-underline'

type ViewState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'already'; teamName: string }
  | { kind: 'invite'; teamName: string; ownerUid: string; teamId: string; team: TeamDoc }
  | { kind: 'thanks'; teamName: string }

export function TeamJoinInvitePage() {
  const { token } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [profileGateDone, setProfileGateDone] = useState(false)
  const [view, setView] = useState<ViewState>({ kind: 'loading' })
  const [acceptBusy, setAcceptBusy] = useState(false)

  useEffect(() => {
    if (!user || !token) return
    let cancelled = false
    void (async () => {
      try {
        const snap = await getDoc(doc(getDb(), 'users', user.uid))
        const p = snap.exists() ? (snap.data() as UserProfileDoc) : null
        if (cancelled) return
        if (!isProfileComplete(p, user)) {
          nav(`/app/complete-profile?redirect=${encodeURIComponent(`/app/join/team/${token}`)}`, {
            replace: true,
          })
          return
        }
        setProfileGateDone(true)
      } catch {
        if (!cancelled) toast.error('Could not load profile')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, token, nav])

  useEffect(() => {
    if (!profileGateDone || !token || !user) return
    let cancelled = false
    void (async () => {
      setView({ kind: 'loading' })
      try {
        const invRef = doc(getDb(), 'userTeamJoinInvites', token)
        const invSnap = await getDoc(invRef)
        if (!invSnap.exists()) {
          if (!cancelled) setView({ kind: 'invalid' })
          return
        }
        const inv = invSnap.data() as UserTeamJoinInviteDoc
        const teamRef = doc(getDb(), 'users', inv.ownerUid, 'teams', inv.teamId)
        const teamSnap = await getDoc(teamRef)
        if (!teamSnap.exists()) {
          if (!cancelled) setView({ kind: 'invalid' })
          return
        }
        const team = teamSnap.data() as TeamDoc
        if (team.joinInviteToken !== token) {
          if (!cancelled) setView({ kind: 'invalid' })
          return
        }
        const displayName =
          team.name?.trim() ||
          inv.teamName?.trim() ||
          'this team'
        const already = team.players.some((p) => p.playerId === user.uid)
        if (already) {
          if (!cancelled) setView({ kind: 'already', teamName: displayName })
          return
        }
        if (!cancelled)
          setView({
            kind: 'invite',
            teamName: displayName,
            ownerUid: inv.ownerUid,
            teamId: inv.teamId,
            team,
          })
      } catch {
        if (!cancelled) {
          toast.error('Could not load invitation')
          setView({ kind: 'invalid' })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profileGateDone, token, user])

  async function onAccept() {
    if (!user || !token || view.kind !== 'invite') return
    const { ownerUid, teamId, team } = view
    let displayName = user.displayName?.trim() ?? ''
    if (!displayName) {
      const ps = await getDoc(doc(getDb(), 'users', user.uid))
      const prof = ps.exists() ? (ps.data() as UserProfileDoc) : null
      displayName = prof?.displayName?.trim() ?? ''
    }
    if (!displayName) displayName = 'Player'
    const nextPlayers = [...team.players, { playerId: user.uid, name: displayName }]
    setAcceptBusy(true)
    try {
      await updateDoc(doc(getDb(), 'users', ownerUid, 'teams', teamId), {
        players: nextPlayers,
      })
      const name =
        view.teamName?.trim() ||
        team.name?.trim() ||
        'the team'
      setView({ kind: 'thanks', teamName: name })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not join team')
    } finally {
      setAcceptBusy(false)
    }
  }

  const shell = 'relative mx-auto min-h-dvh max-w-[768px] overflow-hidden bg-[#f3f4f6] px-5 pb-10 pt-10'

  if (!token) {
    return (
      <div className={shell}>
        <p className="text-center text-sm text-slate-600">Missing invitation.</p>
        <div className="mx-auto mt-6 max-w-md">
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: 'default' }),
              `inline-flex h-11 w-full rounded-xl font-semibold ${PRIMARY_LINK_BTN_TEXT}`,
            )}
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  if (view.kind === 'loading' || !profileGateDone) {
    return (
      <div className={shell}>
        <p className="text-center text-sm text-slate-500">Loading…</p>
      </div>
    )
  }

  if (view.kind === 'invalid') {
    return (
      <div className={shell}>
        <div className="mx-auto max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
          <p className="text-center text-sm leading-relaxed text-slate-600">
            This invitation link is invalid or no longer active.
          </p>
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: 'default' }),
              `mt-6 inline-flex h-11 w-full rounded-xl font-semibold ${PRIMARY_LINK_BTN_TEXT}`,
            )}
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  if (view.kind === 'already') {
    return (
      <div className={shell}>
        <div className="mx-auto max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex justify-center">
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              aria-hidden
            >
              <Users className="size-7" strokeWidth={2} />
            </div>
          </div>
          <p className="text-center text-base font-semibold text-slate-900">
            Already a member of “{view.teamName}”
          </p>
          <p className="mt-2 text-center text-sm text-slate-600">
            You are already on this squad in ScoreTrack.
          </p>
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: 'default' }),
              `mt-6 inline-flex h-11 w-full rounded-xl font-semibold ${PRIMARY_LINK_BTN_TEXT}`,
            )}
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  if (view.kind === 'thanks') {
    return (
      <div className={shell}>
        <div className="mx-auto max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
          <p className="text-center text-lg font-bold text-slate-900">Thanks!</p>
          <p className="mt-2 text-center text-sm text-slate-600">
            You&apos;re now part of “{view.teamName}”.
          </p>
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: 'default' }),
              `mt-6 inline-flex h-11 w-full rounded-xl font-semibold ${PRIMARY_LINK_BTN_TEXT}`,
            )}
          >
            Go to home
          </Link>
        </div>
      </div>
    )
  }

  const invite = view

  return (
    <div className={shell}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-[radial-gradient(120%_80%_at_50%_100%,rgba(229,9,20,0.13),transparent_72%)]" />
      <div className="relative mx-auto max-w-md">
        <div className="mb-8 text-center">
          <img
            src="/brand/scoretrack-logo.png"
            alt="ScoreTrack"
            className="mx-auto h-auto w-full max-w-[220px] drop-shadow-sm"
          />
        </div>

        <div
          className={cn(
            'rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)] sm:p-8',
          )}
        >
          <div className="mb-6 flex justify-center">
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              aria-hidden
            >
              <Users className="size-7" strokeWidth={2} />
            </div>
          </div>
          <p className="text-center text-base leading-relaxed text-slate-800">
            You&apos;ve been invited to join the team <span className="font-semibold">“{invite.teamName}”</span> on
            ScoreTrack.
          </p>
          <p className="mt-3 text-center text-sm text-slate-600">
            Accept the invitation to become part of the squad.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              type="button"
              className="h-11 flex-1 rounded-xl font-semibold sm:min-w-[8rem]"
              disabled={acceptBusy}
              onClick={() => void onAccept()}
            >
              {acceptBusy ? 'Joining…' : 'Accept'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl border-slate-200 font-semibold sm:min-w-[8rem]"
              disabled={acceptBusy}
              onClick={() => nav('/', { replace: true })}
            >
              Decline
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
