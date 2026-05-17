import type { LucideIcon } from 'lucide-react'
import { useId, useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  CircleDot,
  Clock,
  Info,
  MapPin,
  PlayCircle,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { TeamDoc } from '../types/models'
import { BtnPendingLabel } from './Spinner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SQUAD_OPTIONS = Array.from({ length: 14 }, (_, i) => i + 2)
const OVERS_BASE = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 16, 20, 25, 30, 40, 50]
const BOWLER_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1)

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const s = parts[0] ?? '?'
  return s.slice(0, 2).toUpperCase()
}

function truncateName(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function mergeChoices(base: number[], current: number): number[] {
  const set = new Set(base)
  set.add(current)
  return [...set].sort((a, b) => a - b)
}

function nowLocalDateTimeValue(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/** Shared by dropdowns and datetime — bold label text, slate border, primary focus ring */
export const matchFormInputFieldShell =
  'w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'

/** Native `<select>` styling (create match + start-match wizard). */
export const matchFormSelectClass = cn(matchFormInputFieldShell, 'appearance-none pl-3 pr-10')

const inputFieldShell = matchFormInputFieldShell
const selectShell = matchFormSelectClass

/** Primary calendar icon overlay; native picker control stays clickable but hidden (WebKit). */
export const matchFormDatetimeLocalShell = cn(
  inputFieldShell,
  'relative accent-primary pl-3 pr-10 [color-scheme:light]',
  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
)

type TeamPickerProps = {
  side: 'A' | 'B'
  teamId: string
  preview: (TeamDoc & { id: string }) | undefined
  onOpen: () => void
  disabled?: boolean
}

function TeamPickerCard({ side, teamId, preview, onOpen, disabled = false }: TeamPickerProps) {
  const filled = Boolean(teamId && preview)
  return (
    <div className="space-y-2">
      <p className="text-center text-[0.65rem] font-bold uppercase tracking-wider text-primary">
        {side === 'A' ? 'HOME TEAM' : 'AWAY TEAM'}
      </p>
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border-2 bg-white px-3 py-3 text-left transition-colors',
          filled ? 'border-slate-200 shadow-sm' : 'border-dashed border-slate-300 bg-slate-50/80',
          disabled
            ? 'cursor-not-allowed opacity-80'
            : 'hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
        )}
      >
        <div
          className={cn(
            'flex size-[52px] shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-md',
            side === 'A'
              ? filled
                ? 'bg-primary text-primary-foreground'
                : 'bg-slate-200 text-slate-500'
              : filled
                ? 'bg-slate-800 text-white'
                : 'bg-slate-200 text-slate-500',
          )}
          aria-hidden
        >
          {preview ? teamInitials(preview.name) : '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-900">
            {preview ? truncateName(preview.name, 26) : 'Choose team'}
          </p>
          <p className="text-xs font-medium text-slate-500">
            {preview ? `${preview.players.length} players` : 'Tap to select'}
          </p>
        </div>
        {!disabled ? <ChevronDown className="size-5 shrink-0 text-primary" strokeWidth={2.2} aria-hidden /> : null}
      </button>
    </div>
  )
}

const SQUAD_HINT =
  'Each side picks this many players when starting the match. You can edit squads from the scoring screen before toss.'

const OVERS_LIMIT_HINT =
  'Total overs for an innings in this match. Choose a limit that fits your format (e.g. 20 for T20).'

const BOWLER_HINT =
  'Max overs each bowler can bowl in an innings. Set to 4 for typical T20 rules.'

const START_NOW_HINT =
  'Opens scoring right away (toss & playing XI on the next screen). Match time is set to now.'

const SCHEDULE_START_HINT =
  "Choose when the fixture begins. You'll return to your matches list after saving."

function MatchRuleSelectRow({
  icon: Icon,
  label,
  hint,
  infoAriaLabel,
  value,
  onChange,
  options,
  selectAriaLabel,
}: {
  icon: LucideIcon
  label: string
  hint: string
  infoAriaLabel: string
  value: number
  onChange: (n: number) => void
  options: number[]
  selectAriaLabel: string
}) {
  const [infoOpen, setInfoOpen] = useState(false)
  const hintId = useId()

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Icon className="size-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
          <span className="text-sm font-semibold text-slate-900">{label}</span>
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={infoAriaLabel}
            aria-expanded={infoOpen}
            aria-controls={hintId}
            onClick={() => setInfoOpen((o) => !o)}
          >
            <Info className="size-4" strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        <div className="relative w-full shrink-0 sm:w-[8.5rem]">
          <select
            className={selectShell}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={selectAriaLabel}
          >
            {options.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
            aria-hidden
          />
        </div>
      </div>
      <div
        id={hintId}
        role="region"
        aria-live="polite"
        hidden={!infoOpen}
        className="relative rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 pr-9 text-xs leading-relaxed text-slate-600"
      >
        <button
          type="button"
          className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
          aria-label={`Close ${label} info`}
          onClick={() => setInfoOpen(false)}
        >
          <X className="size-3.5" strokeWidth={2.5} aria-hidden />
        </button>
        {hint}
      </div>
    </div>
  )
}

export type MatchFormCreateFieldsProps = {
  pickA: string
  pickB: string
  previewA: (TeamDoc & { id: string }) | undefined
  previewB: (TeamDoc & { id: string }) | undefined
  openPicker: (side: 'A' | 'B') => void
  squadSize: number
  setSquadSize: (n: number) => void
  oversLimit: number
  setOversLimit: (n: number) => void
  oversPerBowler: number
  setOversPerBowler: (n: number) => void
  scheduleMode: 'now' | 'later'
  setScheduleMode: (m: 'now' | 'later') => void
  scheduledAt: string
  setScheduledAt: (s: string) => void
  isPublic: boolean
  setIsPublic: (v: boolean) => void
  /** ICC-style free hit on the ball after a no-ball (default off). */
  freeHitOnNoBall: boolean
  setFreeHitOnNoBall: (v: boolean) => void
  canSubmit: boolean
  writePending: boolean
  error: string | null
  submitIdleLabel?: string
  teamSelectionDisabled?: boolean
  /** When true (match already started / finished), schedule radios & datetime are read-only; public score stays editable. */
  matchStartFieldsLocked?: boolean
  /** Friendly-only: optional ground / city for the public `/live/...` header. */
  friendlyVenue?: string
  setFriendlyVenue?: (v: string) => void
  showFriendlyVenue?: boolean
}

export function MatchFormCreateFields({
  pickA,
  pickB,
  previewA,
  previewB,
  openPicker,
  squadSize,
  setSquadSize,
  oversLimit,
  setOversLimit,
  oversPerBowler,
  setOversPerBowler,
  scheduleMode,
  setScheduleMode,
  scheduledAt,
  setScheduledAt,
  isPublic,
  setIsPublic,
  freeHitOnNoBall,
  setFreeHitOnNoBall,
  canSubmit,
  writePending,
  error,
  submitIdleLabel,
  teamSelectionDisabled = false,
  matchStartFieldsLocked = false,
  friendlyVenue = '',
  setFriendlyVenue,
  showFriendlyVenue = false,
}: MatchFormCreateFieldsProps) {
  const squadChoices = mergeChoices(SQUAD_OPTIONS, squadSize)
  const oversChoices = mergeChoices(OVERS_BASE, oversLimit)
  const bowlerChoices = mergeChoices(BOWLER_OPTIONS, oversPerBowler)
  const startDateTimeInputId = useId()
  const friendlyVenueInputId = useId()
  const friendlyVenueHintId = useId()
  const startNowHintId = useId()
  const scheduleStartHintId = useId()
  const [startNowInfoOpen, setStartNowInfoOpen] = useState(false)
  const [scheduleStartInfoOpen, setScheduleStartInfoOpen] = useState(false)
  const [venueInfoOpen, setVenueInfoOpen] = useState(false)

  return (
    <>
      {!canSubmit && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          Create at least two squads under{' '}
          <Link to="/app/teams" className="font-semibold !text-primary hover:underline">
            My teams
          </Link>{' '}
          before scheduling a match.
        </p>
      )}

      {/* Team selection */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <TeamPickerCard
            side="A"
            teamId={pickA}
            preview={previewA}
            onOpen={() => openPicker('A')}
            disabled={teamSelectionDisabled}
          />
          <div className="flex justify-center">
            <div
              className="flex size-11 items-center justify-center rounded-full bg-primary text-[0.65rem] font-black uppercase tracking-wide text-primary-foreground shadow-md"
              aria-hidden
            >
              VS
            </div>
          </div>
          <TeamPickerCard
            side="B"
            teamId={pickB}
            preview={previewB}
            onOpen={() => openPicker('B')}
            disabled={teamSelectionDisabled}
          />
        </div>

        <div className="mt-4 flex gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-slate-700">
          <Info className="size-5 shrink-0 text-sky-600" strokeWidth={2} aria-hidden />
          <p className="min-w-0 leading-snug">
            {teamSelectionDisabled ? (
              <>
                Home and away teams are locked on edit. Manage squads from{' '}
                <Link to="/app/teams" className="font-semibold !text-primary hover:underline">
                  My teams
                </Link>
                .
              </>
            ) : (
              <>
                Tap <strong className="text-slate-900">HOME TEAM</strong> and{' '}
                <strong className="text-slate-900">AWAY TEAM</strong> to choose squads from{' '}
                <Link to="/app/teams" className="font-semibold !text-primary hover:underline">
                  My teams
                </Link>
                . Both teams are required.
              </>
            )}
          </p>
        </div>
      </section>

      {/* Match rules */}
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
        <MatchRuleSelectRow
          icon={Users}
          label="Players per team"
          hint={SQUAD_HINT}
          infoAriaLabel="About players per team"
          value={squadSize}
          onChange={setSquadSize}
          options={squadChoices}
          selectAriaLabel="Players per team"
        />

        <MatchRuleSelectRow
          icon={Clock}
          label="Overs limit"
          hint={OVERS_LIMIT_HINT}
          infoAriaLabel="About overs limit"
          value={oversLimit}
          onChange={setOversLimit}
          options={oversChoices}
          selectAriaLabel="Overs limit"
        />

        <MatchRuleSelectRow
          icon={CircleDot}
          label="Overs per bowler (per innings)"
          hint={BOWLER_HINT}
          infoAriaLabel="About overs per bowler"
          value={oversPerBowler}
          onChange={setOversPerBowler}
          options={bowlerChoices}
          selectAriaLabel="Overs per bowler"
        />
      </section>

      {/* Match start & privacy */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <PlayCircle className="size-4 text-primary" strokeWidth={2.2} aria-hidden />
          Match start
        </div>

        {matchStartFieldsLocked ? (
          <p className="text-xs leading-relaxed text-slate-500">
            Start options and scheduled time can&apos;t be changed after the match has begun. You can still update{' '}
            <strong className="font-semibold text-slate-700">Public score</strong> below.
          </p>
        ) : null}

        <fieldset
          disabled={matchStartFieldsLocked}
          className={cn(
            'min-w-0 space-y-4 border-0 p-0',
            matchStartFieldsLocked && 'opacity-[0.88]',
          )}
        >
        <div className="flex flex-row flex-nowrap gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div
              className={cn(
                'flex items-start gap-1 rounded-xl border-2 p-2.5 transition-colors sm:min-w-0',
                scheduleMode === 'later'
                  ? 'border-primary/35 bg-primary/[0.06]'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 !flex-row">
                <input
                  type="radio"
                  name="scheduleMode"
                  className="sr-only"
                  checked={scheduleMode === 'later'}
                  onChange={() => setScheduleMode('later')}
                />
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                    scheduleMode === 'later' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500',
                  )}
                >
                  <CalendarDays className="size-[18px]" strokeWidth={2.2} aria-hidden />
                </div>
                <span className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-slate-900">Schedule start</span>
              </label>
              <button
                type="button"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="About Schedule start"
                aria-expanded={scheduleStartInfoOpen}
                aria-controls={scheduleStartHintId}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setScheduleStartInfoOpen((o) => !o)
                }}
              >
                <Info className="size-3.5" strokeWidth={2.2} aria-hidden />
              </button>
            </div>
            <div
              id={scheduleStartHintId}
              role="region"
              aria-live="polite"
              hidden={!scheduleStartInfoOpen}
              className="relative rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 pr-9 text-xs leading-relaxed text-slate-600"
            >
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                aria-label="Close Schedule start info"
                onClick={() => setScheduleStartInfoOpen(false)}
              >
                <X className="size-3.5" strokeWidth={2.5} aria-hidden />
              </button>
              {SCHEDULE_START_HINT}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div
              className={cn(
                'flex items-start gap-1 rounded-xl border-2 p-2.5 transition-colors sm:min-w-0',
                scheduleMode === 'now'
                  ? 'border-primary/35 bg-primary/[0.06]'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 !flex-row">
                <input
                  type="radio"
                  name="scheduleMode"
                  className="sr-only"
                  checked={scheduleMode === 'now'}
                  onChange={() => setScheduleMode('now')}
                />
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                    scheduleMode === 'now' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500',
                  )}
                >
                  <Zap className="size-[18px]" strokeWidth={2.2} aria-hidden />
                </div>
                <span className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-slate-900">Start now</span>
              </label>
              <button
                type="button"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="About Start now"
                aria-expanded={startNowInfoOpen}
                aria-controls={startNowHintId}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setStartNowInfoOpen((o) => !o)
                }}
              >
                <Info className="size-3.5" strokeWidth={2.2} aria-hidden />
              </button>
            </div>
            <div
              id={startNowHintId}
              role="region"
              aria-live="polite"
              hidden={!startNowInfoOpen}
              className="relative rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 pr-9 text-xs leading-relaxed text-slate-600"
            >
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                aria-label="Close Start now info"
                onClick={() => setStartNowInfoOpen(false)}
              >
                <X className="size-3.5" strokeWidth={2.5} aria-hidden />
              </button>
              {START_NOW_HINT}
            </div>
          </div>
        </div>

        {scheduleMode === 'later' && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <CalendarDays className="size-3.5 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
              <label
                htmlFor={startDateTimeInputId}
                className="text-xs font-semibold text-slate-900"
              >
                Start date &amp; time
              </label>
            </div>
            <div className="relative w-full shrink-0 sm:w-56">
              <input
                id={startDateTimeInputId}
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={nowLocalDateTimeValue()}
                required={scheduleMode === 'later'}
                className={cn(matchFormDatetimeLocalShell, 'text-sm')}
              />
              <CalendarDays
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                strokeWidth={2.2}
                aria-hidden
              />
            </div>
          </div>
        )}
        </fieldset>

        {showFriendlyVenue && setFriendlyVenue ? (
          <div className="border-t border-slate-100 pt-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <MapPin className="size-4 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
              <label htmlFor={friendlyVenueInputId} className="text-sm font-semibold text-slate-900">
                Venue / location
              </label>
              <button
                type="button"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="About venue"
                aria-expanded={venueInfoOpen}
                aria-controls={friendlyVenueHintId}
                onClick={() => setVenueInfoOpen((o) => !o)}
              >
                <Info className="size-3.5" strokeWidth={2.2} aria-hidden />
              </button>
            </div>
            <div
              id={friendlyVenueHintId}
              role="region"
              aria-live="polite"
              hidden={!venueInfoOpen}
              className="relative mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 pr-9 text-xs leading-relaxed text-slate-600"
            >
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                aria-label="Close venue info"
                onClick={() => setVenueInfoOpen(false)}
              >
                <X className="size-3.5" strokeWidth={2.5} aria-hidden />
              </button>
              Required for standalone matches. Shown on the public live score link.
            </div>
            <input
              id={friendlyVenueInputId}
              type="text"
              value={friendlyVenue}
              onChange={(e) => setFriendlyVenue(e.target.value)}
              placeholder="e.g. Central Park Oval"
              autoComplete="off"
              required
              className={cn(inputFieldShell, 'mt-2 w-full')}
            />
          </div>
        ) : null}

        <div className="border-t border-slate-100 pt-4">
          <label className="flex !flex-row flex-nowrap cursor-pointer items-center !gap-6 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-colors hover:border-slate-300 focus-within:ring-2 focus-within:ring-primary/25 focus-within:ring-offset-2">
            <input
              type="checkbox"
              checked={freeHitOnNoBall}
              onChange={(e) => setFreeHitOnNoBall(e.target.checked)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'relative inline-flex h-[30px] w-[52px] shrink-0 rounded-full p-[3px] transition-colors duration-200',
                freeHitOnNoBall ? 'bg-rose-100' : 'bg-slate-200',
              )}
            >
              <span
                className={cn(
                  'absolute top-1/2 size-[22px] -translate-y-1/2 rounded-full shadow-md ring-1 ring-black/5 transition-all duration-200 ease-out',
                  freeHitOnNoBall ? 'right-[3px] bg-primary' : 'left-[3px] bg-white',
                )}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-slate-900">Free hit after no ball</span>
              <span className="mt-0.5 block text-sm font-normal text-slate-500">
                When on, the next delivery after a no-ball is a free hit while scoring (only run out can dismiss).
              </span>
            </span>
          </label>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <label className="flex !flex-row flex-nowrap cursor-pointer items-center !gap-6 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-colors hover:border-slate-300 focus-within:ring-2 focus-within:ring-primary/25 focus-within:ring-offset-2">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
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
              <span className="block font-bold text-slate-900">Public score</span>
              <span className="mt-0.5 block text-sm font-normal text-slate-500">
                Allow others to view live scores.
              </span>
            </span>
          </label>
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={!canSubmit || writePending}
        className="h-11 w-full rounded-xl text-sm font-bold !text-primary-foreground shadow-md disabled:opacity-60"
      >
        <BtnPendingLabel
          pending={writePending}
          idle={submitIdleLabel ?? (scheduleMode === 'now' ? '+ Create & start scoring' : '+ Schedule match')}
        />
      </Button>
    </>
  )
}
