import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Info, Users, X } from 'lucide-react'
import { InternalSquadPickerDialogContent } from './InternalSquadPickerDialogContent'
import { useSelectableParentSquads, type SelectableParentSquad } from '../hooks/useSelectableParentSquads'
import { cn } from '@/lib/utils'

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return (parts[0] ?? '?').slice(0, 2).toUpperCase()
}

type Props = {
  isInternal: boolean
  setIsInternal: (v: boolean) => void
  parentOwnerUid: string
  parentTeamId: string
  setParent: (ownerUid: string, teamId: string) => void
  sideAName: string
  setSideAName: (v: string) => void
  sideBName: string
  setSideBName: (v: string) => void
}

function SideNameField({
  label,
  sideName,
  setSideName,
}: {
  label: string
  sideName: string
  setSideName: (v: string) => void
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
      <p className="text-center text-[0.65rem] font-bold uppercase tracking-wider text-primary">{label}</p>
      <input
        type="text"
        value={sideName}
        onChange={(e) => setSideName(e.target.value)}
        placeholder="Side name (e.g. Team Red)"
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        maxLength={48}
      />
    </div>
  )
}

function ParentSquadPicker({
  squads,
  loading,
  ownerUid,
  teamId,
  onSelect,
}: {
  squads: SelectableParentSquad[]
  loading: boolean
  ownerUid: string
  teamId: string
  onSelect: (ownerUid: string, teamId: string) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const [pickerSearch, setPickerSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const selected = squads.find((s) => s.ownerUid === ownerUid && s.teamId === teamId)

  const filteredSquads = useMemo(() => {
    const needle = pickerSearch.trim().toLowerCase()
    if (!needle) return squads
    return squads.filter((s) => {
      const name = s.teamName.toLowerCase()
      const short = s.teamShortName?.trim().toLowerCase() ?? ''
      return name.includes(needle) || short.includes(needle)
    })
  }, [squads, pickerSearch])

  useEffect(() => {
    if (!dialogOpen) return
    searchInputRef.current?.focus()
  }, [dialogOpen])

  function openDialog() {
    setPickerSearch('')
    setDialogOpen(true)
    dialogRef.current?.showModal()
  }

  function closeDialog() {
    dialogRef.current?.close()
    setDialogOpen(false)
    setPickerSearch('')
  }

  function onDialogClose() {
    setDialogOpen(false)
    setPickerSearch('')
  }

  function selectSquad(o: string, t: string) {
    onSelect(o, t)
    closeDialog()
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {selected ? teamInitials(selected.teamName) : '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-900">
            {loading && !selected ? 'Loading squads…' : selected ? selected.teamName : 'Choose team'}
          </p>
          <p className="text-xs text-slate-500">
            {selected ? `${selected.players.length} players in roster` : 'Tap to select'}
          </p>
        </div>
        <ChevronDown className="size-5 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
      </button>

      <dialog
        ref={dialogRef}
        className="team-picker-dialog team-picker-dialog--squad"
        aria-labelledby={titleId}
        onClose={onDialogClose}
      >
        <InternalSquadPickerDialogContent
          titleId={titleId}
          pickerSearch={pickerSearch}
          onPickerSearchChange={setPickerSearch}
          searchInputRef={searchInputRef}
          squads={squads}
          filteredSquads={filteredSquads}
          loading={loading}
          onSelect={selectSquad}
          onClose={closeDialog}
        />
      </dialog>
    </>
  )
}

const MATCH_TYPE_HINT =
  'Friendly matches are played between two different teams. Internal matches split one team into temporary internal squads.'

export function InternalMatchTypeChoice({
  isInternal,
  setIsInternal,
}: {
  isInternal: boolean
  setIsInternal: (v: boolean) => void
}) {
  const [infoOpen, setInfoOpen] = useState(false)
  const hintId = useId()

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-slate-900">What type of match is this?</p>
        <button
          type="button"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="About match types"
          aria-expanded={infoOpen}
          aria-controls={hintId}
          onClick={() => setInfoOpen((o) => !o)}
        >
          <Info className="size-4" strokeWidth={2.2} aria-hidden />
        </button>
      </div>
      <div
        id={hintId}
        role="region"
        aria-live="polite"
        hidden={!infoOpen}
        className="relative mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 pr-9 text-xs leading-relaxed text-slate-600"
      >
        <button
          type="button"
          className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
          aria-label="Close match type info"
          onClick={() => setInfoOpen(false)}
        >
          <X className="size-3.5" strokeWidth={2.5} aria-hidden />
        </button>
        {MATCH_TYPE_HINT}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Match type">
        <button
          type="button"
          onClick={() => setIsInternal(false)}
          className={cn(
            'rounded-xl border-2 px-3 py-3 text-sm font-bold transition-colors',
            !isInternal
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
          )}
        >
          Friendly
        </button>
        <button
          type="button"
          onClick={() => setIsInternal(true)}
          className={cn(
            'rounded-xl border-2 px-3 py-3 text-sm font-bold transition-colors',
            isInternal
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
          )}
        >
          Internal
        </button>
      </div>
    </section>
  )
}

export function InternalMatchCreateFields({
  isInternal,
  parentOwnerUid,
  parentTeamId,
  setParent,
  sideAName,
  setSideAName,
  sideBName,
  setSideBName,
}: Omit<Props, 'setIsInternal'>) {
  const { squads, loading } = useSelectableParentSquads()

  if (isInternal !== true) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Users className="size-4 text-primary" aria-hidden />
        Internal squad setup
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        Choose the team and name each side. Pick players for both sides when you start the match.
      </p>
      <ParentSquadPicker
        squads={squads}
        loading={loading}
        ownerUid={parentOwnerUid}
        teamId={parentTeamId}
        onSelect={setParent}
      />
      {parentOwnerUid && parentTeamId ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SideNameField label="Side A" sideName={sideAName} setSideName={setSideAName} />
          <SideNameField label="Side B" sideName={sideBName} setSideName={setSideBName} />
        </div>
      ) : null}
    </section>
  )
}

export function validateInternalMatchCreate(opts: {
  parentOwnerUid: string
  parentTeamId: string
  sideAName: string
  sideBName: string
}): string | null {
  if (!opts.parentOwnerUid || !opts.parentTeamId) return 'Choose a team.'
  if (!opts.sideAName.trim() || !opts.sideBName.trim()) return 'Enter a name for both sides.'
  if (opts.sideAName.trim().toLowerCase() === opts.sideBName.trim().toLowerCase()) {
    return 'Side names must be different.'
  }
  return null
}
