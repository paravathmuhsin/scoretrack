import { deleteDoc, deleteField, doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { ArrowLeft, Copy, ExternalLink, Share2, Trash2, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { TransferOwnershipDialogContent } from '../components/TransferOwnershipDialogContent'
import { UserTeamForm } from '../components/UserTeamForm'
import type { DirectoryHit } from '../lib/directorySearch'
import {
  cancelOwnershipTransfer,
  createOwnershipTransferRequest,
} from '../lib/teamOwnershipTransfer'
import { notifyNewCoOwners, notifyRemovedCoOwners } from '../lib/coOwnerNotifications'
import { removeSelfCoOwnership } from '../lib/removeCoOwnership'
import { notifyPlayersRemovedFromTeam } from '../lib/rosterNotifications'
import { mergeProtectedRosterForCoOwnerSave, normalizeOwnerIds } from '../lib/teamOwnerIds'
import { Spinner } from '../components/Spinner'
import { usePendingWrites } from '../hooks/usePendingWrites'
import { getDb } from '../firebase/config'
import { buildMemberIdsFromPlayers } from '../lib/matchRosterIndex'
import { syncAccessibleSquadsAfterRosterChange } from '../lib/accessibleSquads'
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
import type { TeamDoc, UserProfileDoc } from '../types/models'
import type { UserTeamFormPayload } from '../components/UserTeamForm'

export function UserTeamEditPage() {
  const { teamId } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const { writePending, run } = usePendingWrites()
  const [team, setTeam] = useState<(TeamDoc & { id: string }) | null>(null)
  const [ownerUid, setOwnerUid] = useState<string | null>(null)
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferBusy, setTransferBusy] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [leaveCoOwnerOpen, setLeaveCoOwnerOpen] = useState(false)
  const [leaveCoOwnerBusy, setLeaveCoOwnerBusy] = useState(false)

  const pathOwnerUid = searchParams.get('owner')?.trim() || user?.uid || ''
  const isPrimaryOwner = Boolean(user && ownerUid && user.uid === ownerUid)
  const isCoOwnerOnly = Boolean(
    user && ownerUid && team && !isPrimaryOwner && (team.ownerIds ?? []).includes(user.uid),
  )

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
      const ouid = ownerUid ?? user.uid
      await setDoc(doc(getDb(), 'userTeamJoinInvites', token), {
        ownerUid: ouid,
        teamId,
        teamName: team.name,
        memberIds: team.players.map((p) => p.playerId),
        createdAt: Timestamp.now(),
      })
      await updateDoc(doc(getDb(), 'users', ouid, 'teams', teamId), {
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
    if (!user || !teamId || !pathOwnerUid) return
    void (async () => {
      setLoadFailed(false)
      setAuthorized(null)
      const ouid = pathOwnerUid
      const tmSnap = await getDoc(doc(getDb(), 'users', ouid, 'teams', teamId))
      if (!tmSnap.exists()) {
        setTeam(null)
        setOwnerUid(null)
        setAuthorized(false)
        setLoadFailed(true)
        return
      }
      const data = { id: tmSnap.id, ...(tmSnap.data() as TeamDoc) }
      const can =
        user.uid === ouid || (data.ownerIds ?? []).includes(user.uid)
      setTeam(data)
      setOwnerUid(ouid)
      setAuthorized(can)
      if (!can) setLoadFailed(true)
    })()
  }, [user, teamId, pathOwnerUid])

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
  if (loadFailed || authorized === false)
    return (
      <div className="mx-auto w-full max-w-3xl pb-2">
        {backToTeams}
        <p className="text-sm text-slate-600">
          {authorized === false ? 'You do not have access to edit this team.' : 'Team not found.'}
        </p>
      </div>
    )
  if (!team || !ownerUid || authorized !== true)
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
                    if (team.pendingOwnershipTransferId) {
                      throw new Error('Cancel the pending transfer before deleting this team.')
                    }
                    await deleteDoc(doc(getDb(), 'users', ownerUid, 'teams', teamId))
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

      {transferModalOpen && isPrimaryOwner ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTransferModalOpen(false)
          }}
        >
          <div onMouseDown={(e) => e.stopPropagation()}>
            <TransferOwnershipDialogContent
              teamName={team.name}
              currentUserUid={user!.uid}
              busy={transferBusy}
              onClose={() => setTransferModalOpen(false)}
              onConfirm={(hit: DirectoryHit) => {
                void (async () => {
                  if (!user) return
                  setTransferBusy(true)
                  try {
                    const fromName =
                      user.displayName?.trim() || user.email?.split('@')[0] || 'Team owner'
                    await createOwnershipTransferRequest(
                      getDb(),
                      user.uid,
                      team,
                      hit.uid,
                      hit.displayName,
                      fromName,
                    )
                    const refreshed = await getDoc(doc(getDb(), 'users', ownerUid, 'teams', teamId))
                    if (refreshed.exists()) {
                      setTeam({ id: refreshed.id, ...(refreshed.data() as TeamDoc) })
                    }
                    setTransferModalOpen(false)
                    toast.success('Transfer request sent. Open Notifications to track status.')
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Could not send request')
                  } finally {
                    setTransferBusy(false)
                  }
                })()
              }}
            />
          </div>
        </div>
      ) : null}

      <UserTeamForm
        key={team.id}
        initial={team}
        submitLabel="Save changes"
        primaryUid={ownerUid ?? ''}
        canManageOwners={isPrimaryOwner}
        onSubmit={async (p: UserTeamFormPayload) => {
          if (!user || !teamId) return
          const prevMemberIds = buildMemberIdsFromPlayers(team.players)
          const prevOwnerIds = team.ownerIds ?? []
          const players = mergeProtectedRosterForCoOwnerSave(
            p.players,
            team.players,
            ownerUid,
            isPrimaryOwner ? [] : prevOwnerIds,
          )
          const nextPlayerIds = new Set(players.map((x) => x.playerId))
          const removedFromRoster = team.players.filter((pl) => !nextPlayerIds.has(pl.playerId))
          const patch: Record<string, unknown> = {
            name: p.name,
            shortName: p.shortName,
            players,
            location: p.location,
            logoUrl: deleteField(),
            memberIds: buildMemberIdsFromPlayers(players),
          }
          const nextOwnerIds = isPrimaryOwner
            ? normalizeOwnerIds(p.ownerIds, players, ownerUid)
            : team.ownerIds ?? []
          if (isPrimaryOwner) {
            patch.ownerIds = nextOwnerIds
          }
          await updateDoc(doc(getDb(), 'users', ownerUid, 'teams', teamId), patch)
          await syncAccessibleSquadsAfterRosterChange(
            getDb(),
            ownerUid,
            teamId,
            { ...p, players, ownerIds: nextOwnerIds },
            prevMemberIds,
          )
          const tok = team.joinInviteToken
          if (tok) {
            await updateDoc(doc(getDb(), 'userTeamJoinInvites', tok), {
              teamName: p.name,
              memberIds: players.map((x) => x.playerId),
            })
          }
          if (isPrimaryOwner) {
            const primaryDisplayName =
              user.displayName?.trim() || user.email?.split('@')[0] || 'Team owner'
            const coOwnerNames: Record<string, string> = {}
            for (const id of new Set([...prevOwnerIds, ...nextOwnerIds])) {
              const pl = players.find((x) => x.playerId === id)
              if (pl) coOwnerNames[id] = pl.name
            }
            await notifyNewCoOwners(getDb(), {
              primaryOwnerUid: ownerUid,
              teamId,
              teamName: p.name,
              primaryDisplayName,
              previousOwnerIds: prevOwnerIds,
              nextOwnerIds,
              newCoOwnerNames: coOwnerNames,
            })
            await notifyRemovedCoOwners(getDb(), {
              primaryOwnerUid: ownerUid,
              teamId,
              teamName: p.name,
              primaryDisplayName,
              previousOwnerIds: prevOwnerIds,
              nextOwnerIds,
              newCoOwnerNames: coOwnerNames,
            })
          }
          if (removedFromRoster.length > 0) {
            const actorDisplayName =
              user.displayName?.trim() || user.email?.split('@')[0] || 'Team manager'
            await notifyPlayersRemovedFromTeam(getDb(), {
              primaryOwnerUid: ownerUid,
              teamId,
              teamName: p.name,
              actorUid: user.uid,
              actorDisplayName,
              removedPlayers: removedFromRoster,
            })
          }
          setTeam({ ...team, ...p, players, ownerIds: nextOwnerIds })
          toast.success('Team saved')
        }}
      />

      {isCoOwnerOnly ? (
        <section
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:p-5"
          aria-labelledby="co-owner-self-heading"
        >
          <h2 id="co-owner-self-heading" className="text-base font-bold text-slate-900">
            Co-ownership
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            You can edit this squad and use it in matches. Removing co-ownership keeps you on the roster as a
            player only, if you are still listed in the squad.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 h-10 w-full border-destructive/55 text-destructive hover:bg-destructive/5"
            disabled={writePending || leaveCoOwnerBusy}
            onClick={() => setLeaveCoOwnerOpen(true)}
          >
            Remove co-ownership
          </Button>
          <AlertDialog open={leaveCoOwnerOpen} onOpenChange={setLeaveCoOwnerOpen}>
            <AlertDialogContent size="sm" className="max-w-[min(100vw-2rem,22rem)] sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Remove co-ownership?</AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-slate-600">
                  You will lose the ability to edit <span className="font-semibold">{team.name}</span> and
                  manage invites. You can stay on the squad as a player if you remain on the roster.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="grid grid-cols-2 gap-3">
                <AlertDialogCancel disabled={leaveCoOwnerBusy}>Cancel</AlertDialogCancel>
                <Button
                  type="button"
                  variant="default"
                  disabled={leaveCoOwnerBusy}
                  onClick={() => {
                    void (async () => {
                      if (!user || !ownerUid || !teamId) return
                      setLeaveCoOwnerBusy(true)
                      try {
                        const coName =
                          user.displayName?.trim() || user.email?.split('@')[0] || 'A player'
                        const ownerSnap = await getDoc(doc(getDb(), 'users', ownerUid))
                        const ownerProf = ownerSnap.exists()
                          ? (ownerSnap.data() as UserProfileDoc).displayName
                          : ''
                        const primaryDisplayName = ownerProf?.trim() || 'Team owner'
                        await removeSelfCoOwnership(
                          getDb(),
                          ownerUid,
                          teamId,
                          user.uid,
                          coName,
                          primaryDisplayName,
                        )
                        setLeaveCoOwnerOpen(false)
                        toast.success('Co-ownership removed')
                        nav('/app/teams')
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Could not remove co-ownership')
                      } finally {
                        setLeaveCoOwnerBusy(false)
                      }
                    })()
                  }}
                >
                  {leaveCoOwnerBusy ? 'Removing…' : 'Remove'}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      ) : null}

      {isPrimaryOwner ? (
        <section
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:p-5"
          aria-labelledby="transfer-ownership-heading"
        >
          <h2 id="transfer-ownership-heading" className="text-base font-bold text-slate-900">
            Transfer ownership
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Send ownership to another registered player. They must accept the request for complete transfer.
            Track status there after you send a request.
          </p>
          {team.pendingOwnershipTransferId ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium text-amber-800">A transfer request is pending.</p>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full"
                disabled={writePending || transferBusy}
                onClick={() => {
                  void (async () => {
                    if (!team.pendingOwnershipTransferId) return
                    setTransferBusy(true)
                    try {
                      await cancelOwnershipTransfer(
                        getDb(),
                        team.pendingOwnershipTransferId,
                        ownerUid,
                      )
                      const refreshed = await getDoc(doc(getDb(), 'users', ownerUid, 'teams', teamId))
                      if (refreshed.exists()) {
                        setTeam({ id: refreshed.id, ...(refreshed.data() as TeamDoc) })
                      }
                      toast.success('Transfer request cancelled')
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Could not cancel')
                    } finally {
                      setTransferBusy(false)
                    }
                  })()
                }}
              >
                Cancel request
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="mt-4 h-10 w-full"
              disabled={writePending}
              onClick={() => setTransferModalOpen(true)}
            >
              Transfer ownership
            </Button>
          )}
        </section>
      ) : null}

      {isPrimaryOwner ? (
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
      ) : null}
    </div>
  )
}
