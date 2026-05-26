import type { LucideIcon } from 'lucide-react'
import { MapPin, Plus, Shield, Tag, User, Users } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { RosterPlayer, TeamDoc } from '../types/models'
import {
  isLikelyRegisteredUserId,
  mergeProtectedRosterForCoOwnerSave,
  normalizeOwnerIds,
} from '../lib/teamOwnerIds'
import { AddPlayersModal } from './AddPlayersModal'
import { BtnPendingLabel } from './Spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type UserTeamFormPayload = {
  name: string
  shortName: string
  location: string | null
  players: RosterPlayer[]
  ownerIds: string[]
}

/** Team abbreviation: letters only, max length, no spaces (enforced in UI + on submit). */
const TEAM_SHORT_CODE_MAX = 3

function normalizeTeamShortCode(raw: string): string {
  return raw
    .replace(/\s/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, TEAM_SHORT_CODE_MAX)
    .toUpperCase()
}

type Props = {
  initial?: TeamDoc & { id: string }
  submitLabel: string
  requireLocation?: boolean
  /** Primary owner uid (doc path). Used to normalize co-owner ids. */
  primaryUid?: string
  canManageOwners?: boolean
  onSubmit: (payload: UserTeamFormPayload) => Promise<void>
}

const MIN_PLAYERS = 2

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  className,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        aria-hidden
      >
        <Icon className="size-5" strokeWidth={2} />
      </div>
      <div className="min-w-0 leading-tight">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

function IconField({
  icon: Icon,
  children,
  className,
  iconClassName = 'text-primary',
}: {
  icon: LucideIcon
  children: ReactNode
  className?: string
  iconClassName?: string
}) {
  return (
    <div
      className={cn(
        'flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 transition-[box-shadow,border-color]',
        'focus-within:border-primary/35 focus-within:shadow-[0_0_0_3px_rgba(229,9,20,0.12)]',
        className,
      )}
    >
      <Icon className={cn('size-4 shrink-0', iconClassName)} strokeWidth={2} aria-hidden />
      {children}
    </div>
  )
}

export function UserTeamForm({
  initial,
  submitLabel,
  requireLocation = false,
  primaryUid = '',
  canManageOwners = false,
  onSubmit,
}: Props) {
  const [name, setName] = useState(() => initial?.name ?? '')
  const [shortName, setShortName] = useState(() => normalizeTeamShortCode(initial?.shortName ?? ''))
  const [location, setLocation] = useState(() => (initial?.location ?? '').trim())
  const [players, setPlayers] = useState<RosterPlayer[]>(() => initial?.players ?? [])
  const [ownerIds, setOwnerIds] = useState<string[]>(() => initial?.ownerIds ?? [])
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function canRemovePlayer(playerId: string): boolean {
    if (primaryUid && playerId === primaryUid) return false
    if (!canManageOwners && ownerIds.includes(playerId)) return false
    return true
  }

  function removePlayer(playerId: string) {
    if (!canRemovePlayer(playerId)) return
    setPlayers((prev) => prev.filter((p) => p.playerId !== playerId))
    setOwnerIds((prev) => prev.filter((id) => id !== playerId))
  }

  function toggleCoOwner(playerId: string) {
    setOwnerIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId],
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const n = name.trim()
    if (!n) {
      setError('Team name is required.')
      return
    }
    const sn = normalizeTeamShortCode(shortName)
    if (!sn) {
      setError('Short code is required (1–3 letters, no spaces).')
      return
    }
    const normalizedLocation = location.trim()
    if (requireLocation && !normalizedLocation) {
      setError('Team city is required.')
      return
    }
    if (players.length < MIN_PLAYERS) {
      setError(
        `Add at least ${MIN_PLAYERS} players from the directory (captain & keeper are chosen when you start a match).`,
      )
      return
    }
    const protectedCoOwnerIds = canManageOwners ? [] : (initial?.ownerIds ?? ownerIds)
    const rosterPlayers = primaryUid
      ? mergeProtectedRosterForCoOwnerSave(
          players,
          initial?.players ?? players,
          primaryUid,
          protectedCoOwnerIds,
        )
      : players
    if (
      primaryUid &&
      (initial?.players ?? []).some((p) => p.playerId === primaryUid) &&
      !rosterPlayers.some((p) => p.playerId === primaryUid)
    ) {
      setError('The team owner cannot be removed from the squad.')
      return
    }
    const normalizedOwners = canManageOwners
      ? normalizeOwnerIds(ownerIds, rosterPlayers, primaryUid)
      : normalizeOwnerIds(initial?.ownerIds ?? [], rosterPlayers, primaryUid)

    setSaving(true)
    try {
      await onSubmit({
        name: n,
        shortName: sn,
        location: normalizedLocation ? normalizedLocation : null,
        players: rosterPlayers,
        ownerIds: normalizedOwners,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save team')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.06)] sm:p-6"
      >
        <div className="space-y-4">
          <SectionHeader
            icon={Shield}
            title="Team details"
            subtitle="Add basic information about your team"
          />
          <div className="space-y-3 pt-1">
            <IconField icon={User}>
              <Input
                id="user-team-name"
                name="teamName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="off"
                placeholder="Enter team name"
                aria-label="Team name (required)"
                className="h-9 flex-1 border-0 bg-transparent px-0 py-0 text-slate-900 shadow-none placeholder:text-placeholder-foreground focus-visible:ring-0 md:text-sm"
              />
            </IconField>
            <IconField icon={Tag} iconClassName="text-primary">
              <Input
                id="user-team-short-name"
                name="teamShortName"
                value={shortName}
                onChange={(e) => setShortName(normalizeTeamShortCode(e.target.value))}
                required
                maxLength={TEAM_SHORT_CODE_MAX}
                autoComplete="off"
                inputMode="text"
                pattern="[A-Za-z]{1,3}"
                placeholder="e.g. CSK"
                aria-label="Short code, 1 to 3 letters, no spaces (required)"
                className="h-9 flex-1 border-0 bg-transparent px-0 py-0 text-slate-900 shadow-none placeholder:text-placeholder-foreground focus-visible:ring-0 md:text-sm"
              />
            </IconField>
            <p className="pl-1 text-xs text-slate-500">
              Up to {TEAM_SHORT_CODE_MAX} letters only — no spaces or numbers.
            </p>
            <IconField icon={MapPin} iconClassName="text-slate-500">
              <Input
                id="user-team-location"
                name="teamLocation"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required={requireLocation}
                placeholder={requireLocation ? 'City or region' : 'City or region (optional)'}
                autoComplete="off"
                aria-label={requireLocation ? 'Team city (required)' : 'Team location (optional)'}
                className="h-9 flex-1 border-0 bg-transparent px-0 py-0 text-slate-900 shadow-none placeholder:text-placeholder-foreground focus-visible:ring-0 md:text-sm"
              />
            </IconField>
          </div>
        </div>

        <div className="border-t border-dotted border-slate-200 pt-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0 sm:gap-x-3">
            <SectionHeader
              className="min-w-0 pr-1"
              icon={Users}
              title="Squad"
              subtitle="Add players to your team"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 self-center justify-self-end rounded-lg border-primary bg-white px-2.5 text-xs text-primary hover:bg-primary/5 sm:px-3 sm:text-sm"
              onClick={() => setModalOpen(true)}
            >
              <Plus className="size-3.5 sm:size-4" strokeWidth={2.5} aria-hidden />
              Add players
            </Button>
          </div>

          {players.length === 0 ? (
            <div className="mt-5 flex min-h-[168px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 text-center">
              <div
                className="mb-3 flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"
                aria-hidden
              >
                <Users className="size-7" strokeWidth={1.75} />
              </div>
              <p className="font-semibold text-slate-900">No players added yet</p>
              <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-slate-500">
                Search and add registered ScoreTrack users to build your team.
              </p>
              <p className="mt-3 text-xs text-slate-400">
                Captain and wicket-keeper are selected when you start scoring a match.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {players.map((p) => {
                const isPrimaryOwnerPlayer =
                  Boolean(primaryUid) && p.playerId === primaryUid
                const isCoOwner = ownerIds.includes(p.playerId)
                const canToggleOwner =
                  canManageOwners && isLikelyRegisteredUserId(p.playerId) && p.playerId !== primaryUid
                return (
                  <li
                    key={p.playerId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 sm:flex-nowrap sm:gap-3"
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span className="min-w-0 truncate font-medium text-slate-900">{p.name}</span>
                      {isPrimaryOwnerPlayer ? (
                        <span className="shrink-0 rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                          Owner
                        </span>
                      ) : null}
                      {isCoOwner && !isPrimaryOwnerPlayer ? (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Co-owner
                        </span>
                      ) : null}
                    </div>
                    <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
                      {canToggleOwner ? (
                        <Button
                          type="button"
                          variant={isCoOwner ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 shrink-0 text-xs"
                          onClick={() => toggleCoOwner(p.playerId)}
                        >
                          {isCoOwner ? 'Remove co-owner' : 'Make co-owner'}
                        </Button>
                      ) : null}
                      {canRemovePlayer(p.playerId) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 border-destructive/45 text-destructive hover:bg-destructive/5"
                          onClick={() => removePlayer(p.playerId)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {error && (
          <p
            className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={saving}
          className="h-12 w-full rounded-xl text-base font-semibold shadow-sm"
        >
          <BtnPendingLabel pending={saving} idle={submitLabel} />
        </Button>
      </form>

      <AddPlayersModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        roster={players}
        onAddPlayers={(added) => setPlayers((prev) => [...prev, ...added])}
      />
    </>
  )
}
