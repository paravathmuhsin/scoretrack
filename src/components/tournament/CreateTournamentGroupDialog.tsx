import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { ModalDialogHeader } from '@/components/ModalDialogHeader'
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { BtnPendingLabel } from '../Spinner'
import { matchFormInputFieldShell } from '../MatchFormCreateFields'
import { TournamentGroupTeamsPicker } from './TournamentGroupTeamsPicker'
import {
  tournamentModalFooterOutlineButtonClass,
  tournamentModalFooterPrimaryButtonClass,
} from './tournamentModalFooterButtons'
import { Button } from '@/components/ui/button'
import { getDb } from '../../firebase/config'
import { linkedTeamIsApproved } from '../../lib/tournamentTeamLinkInvite'
import type { TournamentGroupDoc, TournamentLinkedTeamDoc } from '../../types/models'

type Props = {
  open: boolean
  onClose: () => void
  tournamentId: string
  linkedTeams: (TournamentLinkedTeamDoc & { id: string })[]
  writePending: boolean
  run: <T>(fn: () => Promise<T>) => Promise<T>
  /** When set, dialog edits this group (same chrome as create). */
  editingGroup?: (TournamentGroupDoc & { id: string }) | null
}

function teamLabel(link: TournamentLinkedTeamDoc & { id: string }): string {
  return link.teamName ?? link.userTeamId
}

export function CreateTournamentGroupDialog({
  open,
  onClose,
  tournamentId,
  linkedTeams,
  writePending,
  run,
  editingGroup = null,
}: Props) {
  const fieldId = useId()
  const [name, setName] = useState('')
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set())

  const isEdit = Boolean(editingGroup)

  const linkOptions = useMemo(
    () =>
      linkedTeams
        .filter(linkedTeamIsApproved)
        .map((l) => ({
          id: l.id,
          label: teamLabel(l),
        })),
    [linkedTeams],
  )

  const pendingLinkCount = useMemo(
    () => linkedTeams.filter((l) => l.linkApprovalStatus === 'pending').length,
    [linkedTeams],
  )

  useEffect(() => {
    if (!open) return
    if (editingGroup) {
      setName(editingGroup.name)
      setSelectedLinks(new Set(editingGroup.linkedTeamIds ?? []))
    } else {
      setName('')
      setSelectedLinks(new Set())
    }
  }, [open, editingGroup])

  function addTeam(id: string) {
    setSelectedLinks((prev) => new Set(prev).add(id))
  }

  function removeTeam(id: string) {
    setSelectedLinks((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function close() {
    setName('')
    setSelectedLinks(new Set())
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) {
      toast.error('Enter a group name.')
      return
    }
    if (selectedLinks.size < 2) {
      toast.error('Add at least two teams to this group.')
      return
    }
    try {
      if (editingGroup) {
        await run(() =>
          updateDoc(doc(getDb(), 'tournaments', tournamentId, 'groups', editingGroup.id), {
            name: n,
            linkedTeamIds: [...selectedLinks],
          }),
        )
      } else {
        await run(() =>
          addDoc(collection(getDb(), 'tournaments', tournamentId, 'groups'), {
            name: n,
            linkedTeamIds: [...selectedLinks],
            createdAt: serverTimestamp(),
          }),
        )
      }
      close()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : isEdit ? 'Could not save group' : 'Could not create group',
      )
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="flex min-h-0 max-h-[min(90dvh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${fieldId}-group-dialog-title`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ModalDialogHeader
          shrink
          titleId={`${fieldId}-group-dialog-title`}
          title={isEdit ? 'Edit group' : 'Create group'}
          onClose={() => close()}
        />

        <form noValidate onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 pt-2 pb-4">
            <div className="shrink-0 space-y-2">
              <label htmlFor={`${fieldId}-name`} className="block text-sm font-semibold text-slate-900">
                Group name
              </label>
              <input
                id={`${fieldId}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pool A"
                disabled={writePending}
                className={matchFormInputFieldShell}
              />
            </div>

            {pendingLinkCount > 0 ? (
              <p className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {pendingLinkCount} squad{pendingLinkCount === 1 ? '' : 's'} still awaiting approval — only
                approved squads can be added to a group.
              </p>
            ) : null}

            <TournamentGroupTeamsPicker
              className="min-h-0"
              bleedSelectedStrip
              resetSignal={`${open}-${editingGroup?.id ?? 'new'}`}
              headingId={`${fieldId}-teams-heading`}
              teams={linkOptions}
              selectedIds={selectedLinks}
              onAdd={addTeam}
              onRemove={removeTeam}
              disabled={writePending}
            />
          </div>

          <div className="shrink-0 border-t border-slate-100 p-4">
            <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:gap-3">
              <Button
                type="submit"
                variant="default"
                disabled={writePending || linkOptions.length === 0}
                className={tournamentModalFooterPrimaryButtonClass}
              >
                <BtnPendingLabel pending={writePending} idle={isEdit ? 'Save' : 'Create group'} />
              </Button>
              <Button
                type="button"
                variant="outline"
                className={tournamentModalFooterOutlineButtonClass}
                disabled={writePending}
                onClick={() => close()}
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
