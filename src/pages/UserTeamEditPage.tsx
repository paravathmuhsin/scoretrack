import { deleteDoc, deleteField, doc, getDoc, updateDoc } from 'firebase/firestore'
import { ArrowLeft, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { UserTeamForm } from '../components/UserTeamForm'
import { Spinner } from '../components/Spinner'
import { usePendingWrites } from '../hooks/usePendingWrites'
import { getDb } from '../firebase/config'
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

export function UserTeamEditPage() {
  const { teamId } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const { writePending, run } = usePendingWrites()
  const [team, setTeam] = useState<(TeamDoc & { id: string }) | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

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
                  await run(() => deleteDoc(doc(getDb(), 'users', user.uid, 'teams', teamId)))
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

      <Link
        to="/app/teams"
        className={cn(
          'inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:underline',
          '!text-primary hover:!text-primary visited:!text-primary',
        )}
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        My Teams
      </Link>

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
        onSubmit={async (p) => {
          if (!user) return
          await updateDoc(doc(getDb(), 'users', user.uid, 'teams', teamId), {
            name: p.name,
            shortName: p.shortName,
            players: p.players,
            location: p.location,
            logoUrl: deleteField(),
          })
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
