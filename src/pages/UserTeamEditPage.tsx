import { deleteDoc, deleteField, doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { ArrowLeft, Copy, ExternalLink, Share2, Trash2, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { UserTeamForm } from '../components/UserTeamForm'
import { Spinner } from '../components/Spinner'
import { usePendingWrites } from '../hooks/usePendingWrites'
import { getDb } from '../firebase/config'
import { publicAppUrl } from '../lib/publicAppUrl'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TeamDoc } from '../types/models'
import type { UserTeamFormPayload } from '../components/UserTeamForm'

export function UserTeamEditPage() {
  const { teamId } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const { writePending, run } = usePendingWrites()
  const [team, setTeam] = useState<(TeamDoc & { id: string }) | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)

  const invitationUrl = useMemo(() => {
    if (!team?.joinInviteToken) return ''
    return publicAppUrl(`/app/join/team/${team.joinInviteToken}`)
  }, [team?.joinInviteToken])

  async function ensureInviteLink() {
    if (!user || !teamId || !team) return
    if (team.joinInviteToken) return
    setInviteBusy(true)
    try {
      const token = uuidv4()
      await setDoc(doc(getDb(), 'userTeamJoinInvites', token), {
        ownerUid: user.uid,
        teamId,
        teamName: team.name,
        memberIds: team.players.map((p) => p.playerId),
        createdAt: Timestamp.now(),
      })
      await updateDoc(doc(getDb(), 'users', user.uid, 'teams', teamId), {
        joinInviteToken: token,
      })
      setTeam({ ...team, joinInviteToken: token })
      toast.success('Invitation link created')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create invitation')
    } finally {
      setInviteBusy(false)
    }
  }

  useEffect(() => {
    if (!user || !teamId) return
    void (async () => {
      setLoadFailed(false)
      const tmSnap = await getDoc(doc(getDb(), 'users', user.uid, 'teams', teamId))
      if (!tmSnap.exists()) {
        setTeam(null)
        setLoadFailed(true)
        return
      }
      setTeam({ id: tmSnap.id, ...(tmSnap.data() as TeamDoc) })
    })()
  }, [user, teamId])

  const backToTeams = (
    <Link
      to="/app/teams"
      className={cn(
        'mb-4 inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:underline',
        '!text-primary hover:!text-primary visited:!text-primary',
      )}
    >
      <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
      My Teams
    </Link>
  )

  if (!teamId)
    return (
      <div className="mx-auto w-full max-w-3xl pb-2">
        {backToTeams}
        <p className="text-sm text-slate-600">Missing team id</p>
      </div>
    )
  if (loadFailed)
    return (
      <div className="mx-auto w-full max-w-3xl pb-2">
        {backToTeams}
        <p className="text-sm text-slate-600">Team not found.</p>
      </div>
    )
  if (!team)
    return (
      <div className="mx-auto w-full max-w-3xl pb-2">
        {backToTeams}
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-2">
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent
          size="sm"
          className="max-w-[min(100vw-2rem,22rem)] gap-0 border border-slate-100 p-6 shadow-xl sm:max-w-md"
        >
          <AlertDialogHeader className="flex flex-col items-center justify-center space-y-0 text-center">
            <div
              className="mb-4 flex size-14 shrink-0 items-center justify-center rounded-full bg-rose-100 text-primary"
              aria-hidden
            >
              <Trash2 className="size-7" strokeWidth={2.2} />
            </div>
            <AlertDialogTitle className="text-center text-lg font-bold text-slate-900">Delete team?</AlertDialogTitle>
            <AlertDialogDescription className="mt-2 px-0.5 text-center text-sm leading-relaxed text-slate-500">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-700">{team.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 grid grid-cols-2 gap-3 border-0 bg-transparent p-0 sm:flex sm:flex-row sm:justify-stretch">
            <AlertDialogCancel className="h-10 w-full border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50 sm:flex-1">
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="default"
              className="h-10 w-full !text-primary-foreground no-underline hover:!text-primary-foreground sm:flex-1"
              disabled={writePending}
              onClick={() => {
                void (async () => {
                  if (!user || !teamId) return
                  await run(async () => {
                    if (team.joinInviteToken) {
                      await deleteDoc(doc(getDb(), 'userTeamJoinInvites', team.joinInviteToken))
                    }
                    await deleteDoc(doc(getDb(), 'users', user.uid, 'teams', teamId))
                  })
                  setDeleteDialogOpen(false)
                  nav('/app/teams')
                })()
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {writePending && (
        <div className="write-pending-overlay" role="status" aria-live="polite">
          <div className="write-pending-card">
            <Spinner size="md" />
            <span>Working…</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Link
          to="/app/teams"
          className={cn(
            'inline-flex min-w-0 items-center gap-1.5 text-sm font-medium no-underline hover:underline',
            '!text-primary hover:!text-primary visited:!text-primary',
          )}
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
          My Teams
        </Link>
        <button
          type="button"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10"
          aria-label="Share team invitation link"
          onClick={() => setShareModalOpen(true)}
        >
          <Share2 className="size-[18px]" strokeWidth={2.2} aria-hidden />
        </button>
      </div>

      {shareModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShareModalOpen(false)
          }}
        >
          <div
            className="flex max-h-[min(90dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-invite-share-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="relative shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
              <button
                type="button"
                className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
                onClick={() => setShareModalOpen(false)}
              >
                <X className="size-4" strokeWidth={2.2} />
              </button>
              <div className="flex items-start gap-3 pr-10">
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  aria-hidden
                >
                  <Share2 className="size-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 leading-tight">
                  <h2 id="team-invite-share-title" className="text-lg font-bold text-slate-900">
                    Invite players
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Anyone with this link can sign in and join your squad. Only the roster can change — not the team
                    name or other details.
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!team.joinInviteToken ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">Create a link to share with your players.</p>
                  <Button
                    type="button"
                    className="h-11 w-full rounded-xl font-semibold"
                    disabled={inviteBusy || writePending}
                    onClick={() => void ensureInviteLink()}
                  >
                    {inviteBusy ? 'Creating…' : 'Generate invitation link'}
                  </Button>
                </div>
              ) : (
                <>
                  <label htmlFor="team-invite-url" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Invitation URL
                  </label>
                  <input
                    id="team-invite-url"
                    readOnly
                    value={invitationUrl}
                    onFocus={(e) => e.target.select()}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-900 outline-none ring-primary focus:ring-2 sm:text-sm"
                  />
                </>
              )}
            </div>

            {team.joinInviteToken ? (
              <div className="flex shrink-0 flex-wrap gap-3 border-t border-slate-100 px-5 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-w-0 flex-1 rounded-xl font-semibold sm:flex-initial"
                  disabled={!invitationUrl}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(invitationUrl)
                      .then(() => toast.success('Link copied'))
                      .catch(() => toast.error('Could not copy link'))
                  }}
                >
                  <Copy className="mr-2 size-4 shrink-0" strokeWidth={2.2} aria-hidden />
                  Copy link
                </Button>
                <Button
                  type="button"
                  className="h-11 min-w-0 flex-1 rounded-xl font-semibold sm:flex-initial"
                  disabled={!invitationUrl}
                  onClick={() => {
                    if (team?.joinInviteToken) {
                      nav(`/app/join/team/${team.joinInviteToken}`)
                    }
                  }}
                >
                  <ExternalLink className="mr-2 size-4 shrink-0" strokeWidth={2.2} aria-hidden />
                  Open link
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit team</h1>
          <p className="mt-1 text-sm text-slate-500">Update your team details and squad</p>
        </div>
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden
        >
          <Users className="size-6" strokeWidth={2} />
        </div>
      </div>

      <UserTeamForm
        key={team.id}
        initial={team}
        submitLabel="Save changes"
        onSubmit={async (p: UserTeamFormPayload) => {
          if (!user) return
          await updateDoc(doc(getDb(), 'users', user.uid, 'teams', teamId), {
            name: p.name,
            shortName: p.shortName,
            players: p.players,
            location: p.location,
            logoUrl: deleteField(),
          })
          const tok = team.joinInviteToken
          if (tok) {
            await updateDoc(doc(getDb(), 'userTeamJoinInvites', tok), {
              teamName: p.name,
              memberIds: p.players.map((x) => x.playerId),
            })
          }
        }}
      />

      <section
        className="rounded-2xl border border-rose-200/80 bg-rose-50/60 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:p-5"
        aria-labelledby="delete-team-heading"
      >
        <h2 id="delete-team-heading" className="text-base font-bold text-slate-900">
          Delete team permanently
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Once deleted, this squad is removed from My teams and cannot be recovered. Matches or tournaments that already
          used it may still show historical names or links — only your saved roster under My teams is removed.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={writePending}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 border-destructive/55 bg-white text-destructive hover:bg-destructive/5"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          Delete team
        </Button>
      </section>
    </div>
  )
}
