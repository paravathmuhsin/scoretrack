import { collection, deleteDoc, doc, onSnapshot } from 'firebase/firestore'
import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
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
import { CreateTournamentGroupDialog } from './CreateTournamentGroupDialog'
import { getDb } from '../../firebase/config'
import type { TournamentGroupDoc, TournamentLinkedTeamDoc } from '../../types/models'

type Props = {
  tournamentId: string
  linkedTeams: (TournamentLinkedTeamDoc & { id: string })[]
  writePending: boolean
  run: <T>(fn: () => Promise<T>) => Promise<T>
}

function teamLabel(link: TournamentLinkedTeamDoc & { id: string }): string {
  return link.teamName ?? link.userTeamId
}

export function TournamentGroupsTab({ tournamentId, linkedTeams, writePending, run }: Props) {
  const [groups, setGroups] = useState<(TournamentGroupDoc & { id: string })[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<(TournamentGroupDoc & { id: string }) | null>(null)
  const [groupToDelete, setGroupToDelete] = useState<(TournamentGroupDoc & { id: string }) | null>(null)

  const groupFormOpen = createOpen || editTarget !== null

  function closeGroupForm() {
    setCreateOpen(false)
    setEditTarget(null)
  }

  useEffect(() => {
    const qy = collection(getDb(), 'tournaments', tournamentId, 'groups')
    return onSnapshot(qy, (snap) => {
      const list: (TournamentGroupDoc & { id: string })[] = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TournamentGroupDoc) }))
      list.sort((a, b) => a.name.localeCompare(b.name))
      setGroups(list)
    })
  }, [tournamentId])

  const linkOptions = useMemo(
    () =>
      linkedTeams.map((l) => ({
        id: l.id,
        label: teamLabel(l),
      })),
    [linkedTeams],
  )

  async function confirmDeleteGroup() {
    if (!groupToDelete) return
    try {
      await run(() => deleteDoc(doc(getDb(), 'tournaments', tournamentId, 'groups', groupToDelete.id)))
      setGroupToDelete(null)
    } catch {
      toast.error('Could not delete group.')
    }
  }

  return (
    <div>
      <AlertDialog open={groupToDelete != null} onOpenChange={(open) => !open && setGroupToDelete(null)}>
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
            <AlertDialogTitle className="text-center text-lg font-bold text-slate-900">Delete group?</AlertDialogTitle>
            <AlertDialogDescription className="mt-2 px-0.5 text-center text-sm leading-relaxed text-slate-500">
              Are you sure you want to delete{' '}
              {groupToDelete ? (
                <span className="font-semibold text-slate-700">{groupToDelete.name}</span>
              ) : (
                'this group'
              )}
              ? Scheduled league matches that reference it keep their data; points tables for this group are rebuilt on
              recompute.
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
              onClick={() => void confirmDeleteGroup()}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <h2 className="tabs-panel-heading">Groups</h2>
      <p className="muted small">
        Groups define league-stage pools. Add squads on the Teams tab first, then assign them to a group for league fixtures and points tables.
      </p>

      <div className="flex flex-wrap items-center gap-2 gap-y-2" style={{ marginTop: '0.75rem', marginBottom: '1rem' }}>
        <Button
          type="button"
          variant="default"
          className="font-semibold shadow-sm"
          disabled={writePending || linkedTeams.length < 2}
          title={
            linkedTeams.length < 2
              ? 'Link at least two squads on the Teams tab before creating a group'
              : undefined
          }
          onClick={() => {
            setEditTarget(null)
            setCreateOpen(true)
          }}
        >
          Create group
        </Button>
        {linkedTeams.length < 2 && (
          <span className="text-sm text-muted-foreground">
            Link at least two squads on <strong className="font-semibold text-slate-700">Teams</strong> first.
          </span>
        )}
      </div>

      <CreateTournamentGroupDialog
        open={groupFormOpen}
        editingGroup={editTarget}
        onClose={closeGroupForm}
        tournamentId={tournamentId}
        linkedTeams={linkedTeams}
        writePending={writePending}
        run={run}
      />

      <h3 className="tabs-panel-heading">Your groups</h3>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No groups yet — create one to assign squads to a league pool.</p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0" role="list">
          {groups.map((g) => {
            const membersLine = (g.linkedTeamIds ?? [])
              .map((lid) => linkOptions.find((o) => o.id === lid)?.label ?? lid)
              .join(' · ')
            return (
              <li
                key={g.id}
                className="rounded-xl border border-slate-100 bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                role="listitem"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold leading-snug text-slate-900">{g.name}</p>
                    <p className="mt-1.5 text-sm leading-snug text-slate-600 line-clamp-4">
                      {membersLine || 'No squads in this group yet.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="font-semibold"
                      disabled={writePending}
                      onClick={() => {
                        setCreateOpen(false)
                        setEditTarget(g)
                      }}
                    >
                      Edit group
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={writePending}
                      onClick={() => setGroupToDelete(g)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

    </div>
  )
}
