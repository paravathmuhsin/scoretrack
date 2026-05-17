import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { CalendarDays, MapPin } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { BtnPendingLabel } from '../components/Spinner'
import { matchFormInputFieldShell } from '../components/MatchFormCreateFields'
import { usePendingWrites } from '../hooks/usePendingWrites'
import { dateInputToTimestamp } from '../lib/tournamentFormUtils'
import { getDb } from '../firebase/config'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const sectionClass =
  'rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]'

const inputShell = matchFormInputFieldShell

/** Match-form style native date pickers (same shell + calendar affordance as scheduled datetime). */
const dateInputShell = cn(
  inputShell,
  'relative pl-3 pr-10 [color-scheme:light]',
  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
)

type TournamentField =
  | 'name'
  | 'teamCount'
  | 'defaultSquadSize'
  | 'defaultOversLimit'
  | 'defaultOversPerBowler'
  | 'location'
  | 'startDate'
  | 'endDate'
  | 'description'

type FieldErrors = Partial<Record<TournamentField, string>>

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-900">
      {children}
    </label>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="mt-1 text-sm font-medium text-destructive" role="alert">
      {msg}
    </p>
  )
}

function inputClass(base: string, err?: string) {
  return cn(
    base,
    err && 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/25',
  )
}

/** Local calendar date as `YYYY-MM-DD` for `<input type="date" />`. */
function formatLocalDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Earliest allowed tournament start: tomorrow (start must be strictly in the future). */
function earliestFutureStartDateInput(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 1)
  return formatLocalDateInput(d)
}

export function TournamentNewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { writePending, run } = usePendingWrites()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')
  const [teamCount, setTeamCount] = useState('')
  const [defaultSquadSize, setDefaultSquadSize] = useState('')
  const [defaultOversLimit, setDefaultOversLimit] = useState('')
  const [defaultOversPerBowler, setDefaultOversPerBowler] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)

  function clearFieldError(key: TournamentField) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)

    const errs: FieldErrors = {}

    if (!name.trim()) errs.name = 'Name is required.'
    if (!teamCount.trim()) errs.teamCount = 'Number of teams is required.'
    if (!defaultSquadSize.trim()) errs.defaultSquadSize = 'Players per team is required.'
    if (!defaultOversLimit.trim()) errs.defaultOversLimit = 'Overs limit is required.'
    if (!defaultOversPerBowler.trim()) errs.defaultOversPerBowler = 'Overs per bowler is required.'
    if (!location.trim()) errs.location = 'Location is required.'
    if (!startDate.trim()) errs.startDate = 'Start date is required.'
    if (!endDate.trim()) errs.endDate = 'End date is required.'
    if (!description.trim()) errs.description = 'Description is required.'

    const nTeams = Number.parseInt(teamCount, 10)
    if (!errs.teamCount && (!Number.isFinite(nTeams) || nTeams < 2 || nTeams > 64)) {
      errs.teamCount = 'Enter a number between 2 and 64.'
    }

    const nSquad = Number.parseInt(defaultSquadSize, 10)
    if (!errs.defaultSquadSize && (!Number.isFinite(nSquad) || nSquad < 2 || nSquad > 15)) {
      errs.defaultSquadSize = 'Enter a number between 2 and 15.'
    }

    const nOvers = Number.parseInt(defaultOversLimit, 10)
    if (!errs.defaultOversLimit && (!Number.isFinite(nOvers) || nOvers < 1 || nOvers > 400)) {
      errs.defaultOversLimit = 'Enter a number between 1 and 400.'
    }

    const nOpb = Number.parseInt(defaultOversPerBowler, 10)
    if (!errs.defaultOversPerBowler && (!Number.isFinite(nOpb) || nOpb < 1 || nOpb > 100)) {
      errs.defaultOversPerBowler = 'Enter a number between 1 and 100.'
    }

    const minStart = earliestFutureStartDateInput()
    if (!errs.startDate && startDate.trim() && startDate < minStart) {
      errs.startDate = 'Start date must be in the future (from tomorrow onward).'
    }
    if (!errs.endDate && endDate.trim() && endDate < minStart) {
      errs.endDate = 'End date must be in the future (from tomorrow onward).'
    }
    if (startDate.trim() && endDate.trim() && endDate < startDate) {
      errs.endDate = 'End date must be on or after the start date.'
    }

    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    try {
      const ref = await run(() =>
        addDoc(collection(getDb(), 'tournaments'), {
          name: name.trim(),
          createdBy: user.uid,
          isPublic,
          createdAt: serverTimestamp(),
          teamCount: nTeams,
          location: location.trim(),
          startDate: dateInputToTimestamp(startDate),
          endDate: dateInputToTimestamp(endDate),
          description: description.trim(),
          defaultSquadSize: nSquad,
          defaultOversLimit: nOvers,
          defaultOversPerBowler: nOpb,
        }),
      )
      navigate(`/app/tournaments/${ref.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create tournament')
    }
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-[640px] pb-2">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const minStartDate = earliestFutureStartDateInput()
  const minEndDate = startDate && startDate >= minStartDate ? startDate : minStartDate

  return (
    <div className="mx-auto w-full max-w-[640px] pb-2">
      <header className="mb-1">
        <Link to="/app/tournaments" className="text-sm font-semibold !text-primary hover:underline">
          ← My tournaments
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">New tournament</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Set dates, squad size, and match defaults — you can add teams and fixtures next.
        </p>
      </header>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <section className={cn(sectionClass, 'space-y-4')}>
          <div className="space-y-2">
            <FieldLabel htmlFor="tournament-name">Name</FieldLabel>
            <input
              id="tournament-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                clearFieldError('name')
              }}
              disabled={writePending}
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.name)}
              className={inputClass(inputShell, fieldErrors.name)}
            />
            <FieldError msg={fieldErrors.name} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="tournament-team-count">Number of teams</FieldLabel>
            <input
              id="tournament-team-count"
              type="number"
              inputMode="numeric"
              min={2}
              max={64}
              step={1}
              value={teamCount}
              onChange={(e) => {
                setTeamCount(e.target.value)
                clearFieldError('teamCount')
              }}
              placeholder="e.g. 8"
              disabled={writePending}
              aria-invalid={Boolean(fieldErrors.teamCount)}
              className={inputClass(inputShell, fieldErrors.teamCount)}
            />
            <FieldError msg={fieldErrors.teamCount} />
            <p className="text-xs text-slate-500">Set once for this tournament (2–64). Cannot be changed later.</p>
          </div>
        </section>

        <section className={cn(sectionClass, 'space-y-5')}>
          <div className="space-y-2">
            <FieldLabel htmlFor="tournament-squad">Players per team</FieldLabel>
            <input
              id="tournament-squad"
              type="number"
              min={2}
              max={15}
              step={1}
              value={defaultSquadSize}
              onChange={(e) => {
                setDefaultSquadSize(e.target.value)
                clearFieldError('defaultSquadSize')
              }}
              disabled={writePending}
              aria-invalid={Boolean(fieldErrors.defaultSquadSize)}
              className={inputClass(inputShell, fieldErrors.defaultSquadSize)}
            />
            <FieldError msg={fieldErrors.defaultSquadSize} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="tournament-overs">Overs limit (per innings)</FieldLabel>
            <input
              id="tournament-overs"
              type="number"
              min={1}
              max={400}
              step={1}
              value={defaultOversLimit}
              onChange={(e) => {
                setDefaultOversLimit(e.target.value)
                clearFieldError('defaultOversLimit')
              }}
              disabled={writePending}
              aria-invalid={Boolean(fieldErrors.defaultOversLimit)}
              className={inputClass(inputShell, fieldErrors.defaultOversLimit)}
            />
            <FieldError msg={fieldErrors.defaultOversLimit} />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="tournament-opb">Overs per bowler</FieldLabel>
            <input
              id="tournament-opb"
              type="number"
              min={1}
              max={100}
              step={1}
              value={defaultOversPerBowler}
              onChange={(e) => {
                setDefaultOversPerBowler(e.target.value)
                clearFieldError('defaultOversPerBowler')
              }}
              disabled={writePending}
              aria-invalid={Boolean(fieldErrors.defaultOversPerBowler)}
              className={inputClass(inputShell, fieldErrors.defaultOversPerBowler)}
            />
            <FieldError msg={fieldErrors.defaultOversPerBowler} />
          </div>
        </section>

        <section className={sectionClass}>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
            <div className="min-w-0 flex-1">
              <label htmlFor="tournament-location" className="text-sm font-semibold text-slate-900">
                Venue / location
              </label>
              <p className="mt-1 text-xs leading-snug text-slate-500">
                Shown on public listings and tournament detail.
              </p>
              <input
                id="tournament-location"
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value)
                  clearFieldError('location')
                }}
                placeholder="e.g. Central Park Oval"
                autoComplete="off"
                disabled={writePending}
                aria-invalid={Boolean(fieldErrors.location)}
                className={inputClass(cn(inputShell, 'mt-2'), fieldErrors.location)}
              />
              <FieldError msg={fieldErrors.location} />
            </div>
          </div>
        </section>

        <section className={cn(sectionClass, 'space-y-4')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor="tournament-start">Start date</FieldLabel>
              <div className="relative w-full">
                <input
                  id="tournament-start"
                  type="date"
                  min={minStartDate}
                  value={startDate}
                  onChange={(e) => {
                    const v = e.target.value
                    setStartDate(v)
                    clearFieldError('startDate')
                    clearFieldError('endDate')
                    if (endDate && v && endDate < v) setEndDate('')
                  }}
                  disabled={writePending}
                  aria-invalid={Boolean(fieldErrors.startDate)}
                  className={inputClass(dateInputShell, fieldErrors.startDate)}
                />
                <CalendarDays
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                  strokeWidth={2.2}
                  aria-hidden
                />
              </div>
              <FieldError msg={fieldErrors.startDate} />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="tournament-end">End date</FieldLabel>
              <div className="relative w-full">
                <input
                  id="tournament-end"
                  type="date"
                  min={minEndDate}
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    clearFieldError('endDate')
                    clearFieldError('startDate')
                  }}
                  disabled={writePending}
                  aria-invalid={Boolean(fieldErrors.endDate)}
                  className={inputClass(dateInputShell, fieldErrors.endDate)}
                />
                <CalendarDays
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                  strokeWidth={2.2}
                  aria-hidden
                />
              </div>
              <FieldError msg={fieldErrors.endDate} />
            </div>
          </div>
        </section>

        <section className={cn(sectionClass, 'space-y-2')}>
          <FieldLabel htmlFor="tournament-description">Description</FieldLabel>
          <textarea
            id="tournament-description"
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              clearFieldError('description')
            }}
            placeholder="Format, notes, contact…"
            disabled={writePending}
            aria-invalid={Boolean(fieldErrors.description)}
            className={inputClass(cn(inputShell, 'min-h-[6.5rem] resize-y py-2.5'), fieldErrors.description)}
          />
          <FieldError msg={fieldErrors.description} />
        </section>

        <section className={sectionClass}>
          <label className="flex !flex-row flex-nowrap cursor-pointer items-center !gap-6 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-colors hover:border-slate-300 focus-within:ring-2 focus-within:ring-primary/25 focus-within:ring-offset-2">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={writePending}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'relative inline-flex h-[30px] w-[52px] shrink-0 rounded-full p-[3px] transition-colors duration-200',
                isPublic ? 'bg-rose-100' : 'bg-slate-200',
              )}
            >
              <span
                className={cn(
                  'absolute top-1/2 size-[22px] -translate-y-1/2 rounded-full shadow-md ring-1 ring-black/5 transition-all duration-200 ease-out',
                  isPublic ? 'right-[3px] bg-primary' : 'left-[3px] bg-white',
                )}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-slate-900">Public tournament</span>
              <span className="mt-0.5 block text-sm font-normal text-slate-500">
                Standings and discovery visible without login.
              </span>
            </span>
          </label>
        </section>

        {error && (
          <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="default"
          disabled={writePending}
          className="h-12 w-full rounded-xl text-base font-bold !text-primary-foreground shadow-md disabled:opacity-60"
        >
          <BtnPendingLabel pending={writePending} idle="Create tournament" />
        </Button>
      </form>
    </div>
  )
}
