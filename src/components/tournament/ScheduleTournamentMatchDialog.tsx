import { collection, onSnapshot } from 'firebase/firestore'
import { CalendarDays, ChevronDown, Info, LayoutGrid, SlidersHorizontal, X } from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from 'react'
import { BtnPendingLabel } from '../Spinner'
import {
  matchFormDatetimeLocalShell,
  matchFormInputFieldShell,
  matchFormSelectClass,
} from '../MatchFormCreateFields'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getDb } from '../../firebase/config'
import {
  tournamentModalFooterOutlineButtonClass,
  tournamentModalFooterPrimaryButtonClass,
} from './tournamentModalFooterButtons'
import { createScheduledTournamentMatch } from '../../lib/tournamentCreateMatch'
import { buildTournamentFixtureLabel } from '../../lib/tournamentFixtureLabel'
import { buildTournamentEntrySnapshot } from '../../lib/tournamentMatchSnapshots'
import type {
  TeamDoc,
  TournamentDoc,
  TournamentGroupDoc,
  TournamentLinkedTeamDoc,
  TournamentRoundType,
} from '../../types/models'

type Props = {
  open: boolean
  onClose: () => void
  openNonce: number
  tournamentId: string
  tournament: TournamentDoc & { id: string }
  linkedTeams: (TournamentLinkedTeamDoc & { id: string })[]
  myTeams: (TeamDoc & { id: string })[]
  organiserUid: string
  writePending: boolean
  run: <T>(fn: () => Promise<T>) => Promise<T>
  onGoToGroupsTab: () => void
}

const ROUND_OPTIONS: { value: TournamentRoundType; label: string }[] = [
  { value: 'league', label: 'League match' },
  { value: 'knockout', label: 'Knockout' },
  { value: 'quarter_final', label: 'Quarter final' },
  { value: 'semi_final', label: 'Semi final' },
  { value: 'final', label: 'Final' },
]

function defaultMatchSettings(t: TournamentDoc) {
  return {
    squadSize: t.defaultSquadSize ?? 11,
    oversLimit: t.defaultOversLimit ?? 20,
    oversPerBowler: t.defaultOversPerBowler ?? 4,
  }
}

function linkLabel(l: TournamentLinkedTeamDoc & { id: string }, myTeams: (TeamDoc & { id: string })[]): string {
  return l.teamName ?? myTeams.find((m) => m.id === l.userTeamId)?.name ?? l.userTeamId
}

function leaguePairs(linkIds: string[]): [string, string][] {
  const out: [string, string][] = []
  for (let i = 0; i < linkIds.length; i++) {
    for (let j = i + 1; j < linkIds.length; j++) {
      out.push([linkIds[i]!, linkIds[j]!])
    }
  }
  return out
}

function nowLocalDateTimeValue(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function ScheduleFieldSelect({
  id,
  label,
  disabled,
  placeholder,
  children,
  ...rest
}: Omit<ComponentProps<'select'>, 'className'> & {
  id: string
  label: string
  /** When set, shown as the first empty `<option>` (team pickers). Omit for lists like Round / stage. */
  placeholder?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
      </label>
      <div className="relative w-full">
        <select id={id} className={matchFormSelectClass} disabled={disabled} {...rest}>
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
          strokeWidth={2.2}
          aria-hidden
        />
      </div>
    </div>
  )
}

function ScheduleFieldNumber({
  id,
  label,
  ...rest
}: Omit<ComponentProps<'input'>, 'className' | 'type'> & { id: string; label: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
      </label>
      <input id={id} type="number" className={matchFormInputFieldShell} {...rest} />
    </div>
  )
}

function ScheduleFieldDatetimeLocal({
  id,
  label,
  ...rest
}: Omit<ComponentProps<'input'>, 'className' | 'type'> & { id: string; label: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
      </label>
      <div className="relative w-full">
        <input id={id} type="datetime-local" className={matchFormDatetimeLocalShell} {...rest} />
        <CalendarDays
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary"
          strokeWidth={2.2}
          aria-hidden
        />
      </div>
    </div>
  )
}

/** Put the (linkA, linkB) pairing first with home = linkA for rep 1; returns null if that pair is not in the draw. */
function putFirstMatchPairFirst(pairs: [string, string][], linkSquad1: string, linkSquad2: string): [string, string][] | null {
  const i = pairs.findIndex(
    ([x, y]) => (x === linkSquad1 && y === linkSquad2) || (x === linkSquad2 && y === linkSquad1),
  )
  if (i < 0) return null
  const first: [string, string] = [linkSquad1, linkSquad2]
  return [first, ...pairs.slice(0, i), ...pairs.slice(i + 1)]
}

export function ScheduleTournamentMatchDialog({
  open,
  onClose,
  openNonce,
  tournamentId,
  tournament,
  linkedTeams,
  myTeams,
  organiserUid,
  writePending,
  run,
  onGoToGroupsTab,
}: Props) {
  const fieldId = useId()
  const [defaultsInfoOpen, setDefaultsInfoOpen] = useState(false)
  const [groups, setGroups] = useState<(TournamentGroupDoc & { id: string })[]>([])
  const [round, setRound] = useState<TournamentRoundType>('league')
  const [scheduleStart, setScheduleStart] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [hoursBetween, setHoursBetween] = useState(2)
  const [groupId, setGroupId] = useState('')
  const [meetings, setMeetings] = useState(1)
  const [leagueMode, setLeagueMode] = useState<'manual' | 'auto'>('manual')
  const [autoFirstSquad1Ut, setAutoFirstSquad1Ut] = useState('')
  const [autoFirstSquad2Ut, setAutoFirstSquad2Ut] = useState('')
  const [manualHomeUt, setManualHomeUt] = useState('')
  const [manualAwayUt, setManualAwayUt] = useState('')
  const [finalA, setFinalA] = useState('')
  const [finalB, setFinalB] = useState('')
  const [semi1h, setSemi1h] = useState('')
  const [semi1a, setSemi1a] = useState('')
  const [semi2h, setSemi2h] = useState('')
  const [semi2a, setSemi2a] = useState('')
  const [q1h, setQ1h] = useState('')
  const [q1a, setQ1a] = useState('')
  const [q2h, setQ2h] = useState('')
  const [q2a, setQ2a] = useState('')
  const [q3h, setQ3h] = useState('')
  const [q3a, setQ3a] = useState('')
  const [q4h, setQ4h] = useState('')
  const [q4a, setQ4a] = useState('')
  const [koMatchCount, setKoMatchCount] = useState(1)
  const [koPicks, setKoPicks] = useState<string[]>(['', ''])

  useEffect(() => {
    const qy = collection(getDb(), 'tournaments', tournamentId, 'groups')
    return onSnapshot(qy, (snap) => {
      const list: (TournamentGroupDoc & { id: string })[] = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TournamentGroupDoc) }))
      list.sort((a, b) => a.name.localeCompare(b.name))
      setGroups(list)
    })
  }, [tournamentId])

  useEffect(() => {
    const n = Math.max(2, koMatchCount * 2)
    setKoPicks((prev) => {
      const next = prev.slice(0, n)
      while (next.length < n) next.push('')
      return next
    })
  }, [koMatchCount])

  useEffect(() => {
    if (!open) return
    setDefaultsInfoOpen(false)
    setRound('league')
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    setScheduleStart(d.toISOString().slice(0, 16))
    setHoursBetween(2)
    setGroupId('')
    setMeetings(1)
    setLeagueMode('manual')
    setAutoFirstSquad1Ut('')
    setAutoFirstSquad2Ut('')
    setManualHomeUt('')
    setManualAwayUt('')
    setFinalA('')
    setFinalB('')
    setSemi1h('')
    setSemi1a('')
    setSemi2h('')
    setSemi2a('')
    setQ1h('')
    setQ1a('')
    setQ2h('')
    setQ2a('')
    setQ3h('')
    setQ3a('')
    setQ4h('')
    setQ4a('')
    setKoMatchCount(1)
    setKoPicks(['', ''])
  }, [open, openNonce])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (groups.length && !groups.some((g) => g.id === groupId)) {
      setGroupId(groups[0]!.id)
    }
  }, [groups, groupId])

  const selectedGroup = useMemo(() => groups.find((g) => g.id === groupId), [groups, groupId])

  const leagueLinkOptions = useMemo(() => {
    if (!selectedGroup) return []
    const allow = new Set(selectedGroup.linkedTeamIds ?? [])
    return linkedTeams.filter((l) => allow.has(l.id))
  }, [selectedGroup, linkedTeams])

  useEffect(() => {
    if (autoFirstSquad1Ut && !leagueLinkOptions.some((l) => l.userTeamId === autoFirstSquad1Ut)) {
      setAutoFirstSquad1Ut('')
    }
    if (autoFirstSquad2Ut && !leagueLinkOptions.some((l) => l.userTeamId === autoFirstSquad2Ut)) {
      setAutoFirstSquad2Ut('')
    }
  }, [leagueLinkOptions, autoFirstSquad1Ut, autoFirstSquad2Ut])

  const allKoOptions = useMemo(() => [...linkedTeams].sort((a, b) => linkLabel(a, myTeams).localeCompare(linkLabel(b, myTeams))), [linkedTeams, myTeams])

  const ms = defaultMatchSettings(tournament)

  function close() {
    onClose()
  }

  function teamForUserTeamId(userTeamId: string): (TeamDoc & { id: string }) | undefined {
    return myTeams.find((m) => m.id === userTeamId)
  }

  function linkForUserTeamId(userTeamId: string): (TournamentLinkedTeamDoc & { id: string }) | undefined {
    return linkedTeams.find((l) => l.userTeamId === userTeamId)
  }

  function validateDistinct(ids: string[]): string | null {
    const seen = new Set<string>()
    for (const id of ids) {
      if (!id) return 'Select every team.'
      if (seen.has(id)) return 'Each team must be different in this round.'
      seen.add(id)
    }
    return null
  }

  /** Validates every required field for the current round / mode before submit. */
  function validateScheduleDialog(): string | null {
    if (!scheduleStart?.trim()) {
      return 'First match start time is required.'
    }
    const start = new Date(scheduleStart)
    if (Number.isNaN(start.getTime())) {
      return 'Pick a valid start time for the first fixture.'
    }
    if (start.getTime() <= Date.now()) {
      return 'First fixture start time must be in the future.'
    }

    if (!Number.isFinite(hoursBetween) || hoursBetween < 0) {
      return 'Hours between matches is required (enter 0 or more).'
    }

    if (round === 'league') {
      if (groups.length === 0) {
        return 'Create at least one group on the Groups tab before scheduling league matches.'
      }
      if (!selectedGroup || !groupId) {
        return 'Select a group.'
      }
      if (leagueLinkOptions.length < 2) {
        return 'This group needs at least two squads.'
      }
      if (!Number.isFinite(meetings) || meetings < 1 || meetings > 9) {
        return 'Matches between each pair must be between 1 and 9.'
      }

      if (leagueMode === 'manual') {
        if (!manualHomeUt || !manualAwayUt) {
          return 'Select home and away teams for the match.'
        }
        if (manualHomeUt === manualAwayUt) {
          return 'Home and away teams must be different.'
        }
        const inGroup = (ut: string) => leagueLinkOptions.some((l) => l.userTeamId === ut)
        if (!inGroup(manualHomeUt) || !inGroup(manualAwayUt)) {
          return 'Both teams must belong to the selected group.'
        }
        return null
      }

      const linkIds = [...(selectedGroup.linkedTeamIds ?? [])]
      if (linkIds.length < 2) {
        return 'This group needs at least two linked squads.'
      }
      const pairsRaw = leaguePairs(linkIds)
      if (pairsRaw.length === 0) {
        return 'Not enough teams for fixtures.'
      }
      if (!autoFirstSquad1Ut || !autoFirstSquad2Ut) {
        return 'Select home and away teams for the first auto-generated match.'
      }
      if (autoFirstSquad1Ut === autoFirstSquad2Ut) {
        return 'Home and away teams for the first match must be different.'
      }
      const link1 = leagueLinkOptions.find((l) => l.userTeamId === autoFirstSquad1Ut)
      const link2 = leagueLinkOptions.find((l) => l.userTeamId === autoFirstSquad2Ut)
      if (!link1 || !link2) {
        return 'Both home and away teams must belong to the selected group.'
      }
      const reordered = putFirstMatchPairFirst(pairsRaw, link1.id, link2.id)
      if (!reordered) {
        return 'The chosen teams are not in the same group draw (check group membership).'
      }
      return null
    }

    if (round === 'final') {
      if (!finalA || !finalB) {
        return 'Select home and away teams for the final.'
      }
      return validateDistinct([finalA, finalB])
    }
    if (round === 'semi_final') {
      if (!semi1h || !semi1a || !semi2h || !semi2a) {
        return 'Select home and away teams for both semi finals (four teams in total).'
      }
      return validateDistinct([semi1h, semi1a, semi2h, semi2a])
    }
    if (round === 'quarter_final') {
      if (!q1h || !q1a || !q2h || !q2a || !q3h || !q3a || !q4h || !q4a) {
        return 'Select home and away teams for every quarter final.'
      }
      return validateDistinct([q1h, q1a, q2h, q2a, q3h, q3a, q4h, q4a])
    }

    if (!Number.isFinite(koMatchCount) || koMatchCount < 1 || koMatchCount > 16) {
      return 'Number of matches must be between 1 and 16.'
    }
    const needed = koMatchCount * 2
    for (let i = 0; i < needed; i++) {
      if (!koPicks[i]?.trim()) {
        return 'Select home and away teams for every knockout match.'
      }
    }
    return validateDistinct(koPicks.slice(0, needed))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validationError = validateScheduleDialog()
    if (validationError) {
      toast.error(validationError)
      return
    }

    const start = new Date(scheduleStart)
    let slot = 0
    const nextTime = () => new Date(start.getTime() + slot++ * hoursBetween * 60 * 60 * 1000)
    const db = getDb()

    try {
      if (round === 'league') {
        const gName = selectedGroup!.name
        const gid = selectedGroup!.id

        if (leagueMode === 'manual') {
          const lh = linkForUserTeamId(manualHomeUt)
          const la = linkForUserTeamId(manualAwayUt)
          const th = teamForUserTeamId(manualHomeUt)
          const ta = teamForUserTeamId(manualAwayUt)
          if (!lh || !la || !th || !ta) {
            toast.error('Could not resolve teams. Refresh and try again.')
            return
          }
          const label = buildTournamentFixtureLabel(th.name, ta.name, 'league', gName)
          await run(() =>
            createScheduledTournamentMatch(db, {
              tournamentId,
              organiserUid,
              home: buildTournamentEntrySnapshot(th, lh.id),
              away: buildTournamentEntrySnapshot(ta, la.id),
              scheduledAt: nextTime(),
              label,
              tournamentRound: 'league',
              tournamentGroupId: gid,
              squadSize: ms.squadSize,
              oversLimit: ms.oversLimit,
              oversPerBowler: ms.oversPerBowler,
            }),
          )
          close()
          return
        }

        // auto: all pairs × meetings (ordering validated in validateScheduleDialog)
        const linkIds = [...(selectedGroup!.linkedTeamIds ?? [])]
        const pairsRaw = leaguePairs(linkIds)
        const link1 = leagueLinkOptions.find((l) => l.userTeamId === autoFirstSquad1Ut)!
        const link2 = leagueLinkOptions.find((l) => l.userTeamId === autoFirstSquad2Ut)!
        const pairs = putFirstMatchPairFirst(pairsRaw, link1.id, link2.id)!
        const total = pairs.length * meetings
        if (total > 80 && !confirm(`This will create ${total} scheduled matches. Continue?`)) {
          return
        }
        for (const [linkA, linkB] of pairs) {
          for (let rep = 1; rep <= meetings; rep++) {
            const swap = rep % 2 === 0
            const la = linkedTeams.find((l) => l.id === (swap ? linkB : linkA))
            const lb = linkedTeams.find((l) => l.id === (swap ? linkA : linkB))
            if (!la || !lb) continue
            const th = teamForUserTeamId(la.userTeamId)
            const ta = teamForUserTeamId(lb.userTeamId)
            if (!th || !ta) continue
            const label = buildTournamentFixtureLabel(th.name, ta.name, 'league', gName)
            await run(() =>
              createScheduledTournamentMatch(db, {
                tournamentId,
                organiserUid,
                home: buildTournamentEntrySnapshot(th, la.id),
                away: buildTournamentEntrySnapshot(ta, lb.id),
                scheduledAt: nextTime(),
                label,
                tournamentRound: 'league',
                tournamentGroupId: gid,
                squadSize: ms.squadSize,
                oversLimit: ms.oversLimit,
                oversPerBowler: ms.oversPerBowler,
              }),
            )
          }
        }
        close()
        return
      }

      // Knockout-style rounds (validated in validateScheduleDialog)
      let fixtures: { homeUt: string; awayUt: string }[] = []

      if (round === 'final') {
        fixtures = [{ homeUt: finalA, awayUt: finalB }]
      } else if (round === 'semi_final') {
        fixtures = [
          { homeUt: semi1h, awayUt: semi1a },
          { homeUt: semi2h, awayUt: semi2a },
        ]
      } else if (round === 'quarter_final') {
        fixtures = [
          { homeUt: q1h, awayUt: q1a },
          { homeUt: q2h, awayUt: q2a },
          { homeUt: q3h, awayUt: q3a },
          { homeUt: q4h, awayUt: q4a },
        ]
      } else {
        const picks = koPicks.slice(0, koMatchCount * 2)
        for (let i = 0; i < picks.length; i += 2) {
          fixtures.push({ homeUt: picks[i]!, awayUt: picks[i + 1]! })
        }
      }

      for (const { homeUt, awayUt } of fixtures) {
        const lh = linkForUserTeamId(homeUt)
        const la = linkForUserTeamId(awayUt)
        const th = teamForUserTeamId(homeUt)
        const ta = teamForUserTeamId(awayUt)
        if (!lh || !la || !th || !ta) {
          toast.error('Every team must be linked to this tournament (Teams tab).')
          return
        }
        const label = buildTournamentFixtureLabel(th.name, ta.name, round)
        await run(() =>
          createScheduledTournamentMatch(db, {
            tournamentId,
            organiserUid,
            home: buildTournamentEntrySnapshot(th, lh.id),
            away: buildTournamentEntrySnapshot(ta, la.id),
            scheduledAt: nextTime(),
            label,
            tournamentRound: round,
            tournamentGroupId: null,
            squadSize: ms.squadSize,
            oversLimit: ms.oversLimit,
            oversPerBowler: ms.oversPerBowler,
          }),
        )
      }
      close()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create matches')
    }
  }

  const showLeague = round === 'league'
  const showKoBlocks = round !== 'league'

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
        aria-labelledby="schedule-match-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
          <button
            type="button"
            className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
            onClick={() => close()}
          >
            <X className="size-4" strokeWidth={2.2} />
          </button>
          <div className="flex items-start gap-3 pr-10">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              aria-hidden
            >
              <CalendarDays className="size-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1">
                <h2 id="schedule-match-title" className="text-lg font-bold text-slate-900">
                  Schedule tournament match
                </h2>
                <button
                  type="button"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  aria-label="About tournament match defaults"
                  aria-expanded={defaultsInfoOpen}
                  aria-controls={`${fieldId}-defaults-hint`}
                  onClick={(e) => {
                    e.preventDefault()
                    setDefaultsInfoOpen((o) => !o)
                  }}
                >
                  <Info className="size-4" strokeWidth={2.2} aria-hidden />
                </button>
              </div>
              <div
                id={`${fieldId}-defaults-hint`}
                role="region"
                aria-live="polite"
                hidden={!defaultsInfoOpen}
                className="relative mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 pr-9 text-xs leading-relaxed text-slate-600"
              >
                <button
                  type="button"
                  className="absolute right-2 top-2 inline-flex size-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                  aria-label="Close tournament defaults info"
                  onClick={() => setDefaultsInfoOpen(false)}
                >
                  <X className="size-3.5" strokeWidth={2.5} aria-hidden />
                </button>
                Defaults from tournament:{' '}
                <strong className="font-semibold text-slate-800">{ms.squadSize}</strong> players per team,{' '}
                <strong className="font-semibold text-slate-800">{ms.oversLimit}</strong> overs,{' '}
                <strong className="font-semibold text-slate-800">{ms.oversPerBowler}</strong> overs per bowler. Edit under{' '}
                <strong className="font-semibold text-slate-800">Edit tournament details</strong> on Overview.
              </div>
            </div>
          </div>
        </div>

        <form noValidate onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          <ScheduleFieldSelect
            id={`${fieldId}-round`}
            label="Round / stage"
            value={round}
            onChange={(e) => setRound(e.target.value as TournamentRoundType)}
            disabled={writePending}
          >
            {ROUND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </ScheduleFieldSelect>

          <ScheduleFieldDatetimeLocal
            id={`${fieldId}-start`}
            label="First match starts (local time)"
            value={scheduleStart}
            onChange={(e) => setScheduleStart(e.target.value)}
            min={nowLocalDateTimeValue()}
            disabled={writePending}
          />

          <ScheduleFieldNumber
            id={`${fieldId}-hours`}
            label="Hours between matches (when creating several)"
            min={0}
            step={0.5}
            value={hoursBetween}
            onChange={(e) => setHoursBetween(Number(e.target.value))}
            disabled={writePending}
          />

          {showLeague && groups.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-800">
              <p className="m-0 leading-snug">
                No groups yet. Create a group on the <strong className="font-semibold text-slate-900">Groups</strong> tab and add squads to it before scheduling league
                fixtures.
              </p>
              <Button
                type="button"
                variant="default"
                className="mt-3 font-semibold shadow-sm"
                disabled={writePending}
                onClick={() => {
                  onGoToGroupsTab()
                  close()
                }}
              >
                Open Groups tab
              </Button>
            </div>
          )}

          {showLeague && groups.length > 0 && (
            <>
              <ScheduleFieldSelect
                id={`${fieldId}-group`}
                label="Group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                disabled={writePending}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </ScheduleFieldSelect>

              <ScheduleFieldNumber
                id={`${fieldId}-meetings`}
                label="Matches between each pair (round-robin repetitions)"
                min={1}
                max={9}
                step={1}
                value={meetings}
                onChange={(e) => setMeetings(Number(e.target.value))}
                disabled={writePending}
              />

              <fieldset disabled={writePending} className="min-w-0 space-y-2 border-0 p-0">
                <legend className="mb-2 block text-sm font-semibold text-slate-900">
                  Create mode
                </legend>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label
                    className={cn(
                      'flex min-h-[4.5rem] min-w-0 flex-1 cursor-pointer rounded-xl border-2 p-3 transition-colors',
                      leagueMode === 'manual'
                        ? 'border-primary/35 bg-primary/[0.06]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <input
                      type="radio"
                      name="leagueMode"
                      className="sr-only"
                      checked={leagueMode === 'manual'}
                      onChange={() => setLeagueMode('manual')}
                    />
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div
                        className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-lg',
                          leagueMode === 'manual' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        <SlidersHorizontal className="size-5" strokeWidth={2.2} aria-hidden />
                      </div>
                      <span className="min-w-0">
                        <span className="block font-bold text-slate-900">Manual</span>
                        <span className="mt-0.5 block text-xs font-normal leading-snug text-slate-500">
                          Pick home and away yourself
                        </span>
                      </span>
                    </div>
                  </label>
                  <label
                    className={cn(
                      'flex min-h-[4.5rem] min-w-0 flex-1 cursor-pointer rounded-xl border-2 p-3 transition-colors',
                      leagueMode === 'auto'
                        ? 'border-primary/35 bg-primary/[0.06]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <input
                      type="radio"
                      name="leagueMode"
                      className="sr-only"
                      checked={leagueMode === 'auto'}
                      onChange={() => setLeagueMode('auto')}
                    />
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div
                        className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-lg',
                          leagueMode === 'auto' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        <LayoutGrid className="size-5" strokeWidth={2.2} aria-hidden />
                      </div>
                      <span className="min-w-0">
                        <span className="block font-bold text-slate-900">Auto</span>
                        <span className="mt-0.5 block text-xs font-normal leading-snug text-slate-500">
                          All pairs in this group × repetitions above
                        </span>
                      </span>
                    </div>
                  </label>
                </div>
              </fieldset>

              {leagueMode === 'auto' && (
                <>
                  <ScheduleFieldSelect
                    id={`${fieldId}-auto-s1`}
                    label="First match — home team"
                    placeholder="Select team"
                    value={autoFirstSquad1Ut}
                    onChange={(e) => {
                      const v = e.target.value
                      setAutoFirstSquad1Ut(v)
                      if (v && v === autoFirstSquad2Ut) setAutoFirstSquad2Ut('')
                    }}
                    disabled={writePending}
                    required
                  >
                    {leagueLinkOptions.map((l) => (
                      <option key={`auto1-${l.id}`} value={l.userTeamId}>
                        {linkLabel(l, myTeams)}
                      </option>
                    ))}
                  </ScheduleFieldSelect>
                  <ScheduleFieldSelect
                    id={`${fieldId}-auto-s2`}
                    label="First match — away team"
                    placeholder="Select team"
                    value={autoFirstSquad2Ut}
                    onChange={(e) => setAutoFirstSquad2Ut(e.target.value)}
                    disabled={writePending}
                    required
                  >
                    {leagueLinkOptions
                      .filter((l) => l.userTeamId !== autoFirstSquad1Ut)
                      .map((l) => (
                        <option key={`auto2-${l.id}`} value={l.userTeamId}>
                          {linkLabel(l, myTeams)}
                        </option>
                      ))}
                  </ScheduleFieldSelect>
                  <p className="-mt-1 text-xs leading-snug text-slate-500">
                    The first scheduled fixture uses this home vs away pairing for the first leg; then all other group pairs are generated in order.
                  </p>
                </>
              )}
              {leagueMode === 'manual' && (
                <>
                  <ScheduleFieldSelect
                    id={`${fieldId}-manual-home`}
                    label="Home team"
                    placeholder="Select team"
                    value={manualHomeUt}
                    onChange={(e) => setManualHomeUt(e.target.value)}
                    disabled={writePending}
                  >
                    {leagueLinkOptions.map((l) => (
                      <option key={l.id} value={l.userTeamId}>
                        {linkLabel(l, myTeams)}
                      </option>
                    ))}
                  </ScheduleFieldSelect>
                  <ScheduleFieldSelect
                    id={`${fieldId}-manual-away`}
                    label="Away team"
                    placeholder="Select team"
                    value={manualAwayUt}
                    onChange={(e) => setManualAwayUt(e.target.value)}
                    disabled={writePending}
                  >
                    {leagueLinkOptions.map((l) => (
                      <option key={`a-${l.id}`} value={l.userTeamId}>
                        {linkLabel(l, myTeams)}
                      </option>
                    ))}
                  </ScheduleFieldSelect>
                </>
              )}
            </>
          )}

          {showKoBlocks && round === 'final' && (
            <>
              <ScheduleFieldSelect
                id={`${fieldId}-final-a`}
                label="Home team"
                placeholder="Select team"
                value={finalA}
                onChange={(e) => setFinalA(e.target.value)}
                disabled={writePending}
              >
                {allKoOptions.map((l) => (
                  <option key={l.id} value={l.userTeamId}>
                    {linkLabel(l, myTeams)}
                  </option>
                ))}
              </ScheduleFieldSelect>
              <ScheduleFieldSelect
                id={`${fieldId}-final-b`}
                label="Away team"
                placeholder="Select team"
                value={finalB}
                onChange={(e) => setFinalB(e.target.value)}
                disabled={writePending}
              >
                {allKoOptions.map((l) => (
                  <option key={`b-${l.id}`} value={l.userTeamId}>
                    {linkLabel(l, myTeams)}
                  </option>
                ))}
              </ScheduleFieldSelect>
            </>
          )}

          {showKoBlocks && round === 'semi_final' && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semi final A</p>
              <ScheduleFieldSelect
                id={`${fieldId}-semi1-h`}
                label="Home team"
                placeholder="Select team"
                value={semi1h}
                onChange={(e) => setSemi1h(e.target.value)}
                disabled={writePending}
              >
                {allKoOptions.map((l) => (
                  <option key={l.id} value={l.userTeamId}>
                    {linkLabel(l, myTeams)}
                  </option>
                ))}
              </ScheduleFieldSelect>
              <ScheduleFieldSelect
                id={`${fieldId}-semi1-a`}
                label="Away team"
                placeholder="Select team"
                value={semi1a}
                onChange={(e) => setSemi1a(e.target.value)}
                disabled={writePending}
              >
                {allKoOptions.map((l) => (
                  <option key={`s1a-${l.id}`} value={l.userTeamId}>
                    {linkLabel(l, myTeams)}
                  </option>
                ))}
              </ScheduleFieldSelect>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semi final B</p>
              <ScheduleFieldSelect
                id={`${fieldId}-semi2-h`}
                label="Home team"
                placeholder="Select team"
                value={semi2h}
                onChange={(e) => setSemi2h(e.target.value)}
                disabled={writePending}
              >
                {allKoOptions.map((l) => (
                  <option key={`s2h-${l.id}`} value={l.userTeamId}>
                    {linkLabel(l, myTeams)}
                  </option>
                ))}
              </ScheduleFieldSelect>
              <ScheduleFieldSelect
                id={`${fieldId}-semi2-a`}
                label="Away team"
                placeholder="Select team"
                value={semi2a}
                onChange={(e) => setSemi2a(e.target.value)}
                disabled={writePending}
              >
                {allKoOptions.map((l) => (
                  <option key={`s2a-${l.id}`} value={l.userTeamId}>
                    {linkLabel(l, myTeams)}
                  </option>
                ))}
              </ScheduleFieldSelect>
            </>
          )}

          {showKoBlocks && round === 'quarter_final' && (
            <>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="space-y-3 rounded-xl border border-slate-100 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quarter final {n}</p>
                  <ScheduleFieldSelect
                    id={`${fieldId}-qf-${n}-h`}
                    label="Home team"
                    placeholder="Select team"
                    value={n === 1 ? q1h : n === 2 ? q2h : n === 3 ? q3h : q4h}
                    onChange={(e) => {
                      const v = e.target.value
                      if (n === 1) setQ1h(v)
                      else if (n === 2) setQ2h(v)
                      else if (n === 3) setQ3h(v)
                      else setQ4h(v)
                    }}
                    disabled={writePending}
                  >
                    {allKoOptions.map((l) => (
                      <option key={`q${n}h-${l.id}`} value={l.userTeamId}>
                        {linkLabel(l, myTeams)}
                      </option>
                    ))}
                  </ScheduleFieldSelect>
                  <ScheduleFieldSelect
                    id={`${fieldId}-qf-${n}-a`}
                    label="Away team"
                    placeholder="Select team"
                    value={n === 1 ? q1a : n === 2 ? q2a : n === 3 ? q3a : q4a}
                    onChange={(e) => {
                      const v = e.target.value
                      if (n === 1) setQ1a(v)
                      else if (n === 2) setQ2a(v)
                      else if (n === 3) setQ3a(v)
                      else setQ4a(v)
                    }}
                    disabled={writePending}
                  >
                    {allKoOptions.map((l) => (
                      <option key={`q${n}a-${l.id}`} value={l.userTeamId}>
                        {linkLabel(l, myTeams)}
                      </option>
                    ))}
                  </ScheduleFieldSelect>
                </div>
              ))}
            </>
          )}

          {showKoBlocks && round === 'knockout' && (
            <>
              <ScheduleFieldNumber
                id={`${fieldId}-ko-count`}
                label="Number of matches (pairs) in this knockout round"
                min={1}
                max={16}
                step={1}
                value={koMatchCount}
                onChange={(e) => setKoMatchCount(Math.max(1, Math.min(16, Number(e.target.value) || 1)))}
                disabled={writePending}
              />
              <p className="text-xs leading-snug text-slate-500">For each match, select home team then away team in order.</p>
              {Array.from({ length: koMatchCount }, (_, mi) => (
                <div key={mi} className="space-y-3 rounded-xl border border-slate-100 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Match {mi + 1}</p>
                  <ScheduleFieldSelect
                    id={`${fieldId}-ko-${mi}-h`}
                    label="Home team"
                    placeholder="Select team"
                    value={koPicks[mi * 2] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setKoPicks((prev) => {
                        const next = [...prev]
                        next[mi * 2] = v
                        return next
                      })
                    }}
                    disabled={writePending}
                  >
                    {allKoOptions.map((l) => (
                      <option key={`ko-${mi}-h-${l.id}`} value={l.userTeamId}>
                        {linkLabel(l, myTeams)}
                      </option>
                    ))}
                  </ScheduleFieldSelect>
                  <ScheduleFieldSelect
                    id={`${fieldId}-ko-${mi}-a`}
                    label="Away team"
                    placeholder="Select team"
                    value={koPicks[mi * 2 + 1] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setKoPicks((prev) => {
                        const next = [...prev]
                        next[mi * 2 + 1] = v
                        return next
                      })
                    }}
                    disabled={writePending}
                  >
                    {allKoOptions.map((l) => (
                      <option key={`ko-${mi}-a-${l.id}`} value={l.userTeamId}>
                        {linkLabel(l, myTeams)}
                      </option>
                    ))}
                  </ScheduleFieldSelect>
                </div>
              ))}
            </>
          )}

          </div>

          <div className="shrink-0 border-t border-slate-100 p-4">
            <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:gap-3">
              <Button
                type="submit"
                variant="default"
                disabled={writePending}
                className={tournamentModalFooterPrimaryButtonClass}
              >
                <BtnPendingLabel pending={writePending} idle="Create match(es)" />
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
