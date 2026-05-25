import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { ArrowLeft, Plus, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AddPlayersModal } from '../components/AddPlayersModal'
import { SquadSummaryTile } from '../components/PlayingSquadTiles'
import { BtnPendingLabel } from '../components/Spinner'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SQUAD_SUMMARY_TILE_LIST_CLASS } from '@/lib/playingSquadTiles'
import { getDb } from '../firebase/config'
import { buildRosterPlayerIds } from '../lib/matchRosterIndex'
import type { MatchDoc, MatchLineup, RosterPlayer } from '../types/models'

const MIN_PLAYERS = 2

/** Keep playing XI in sync with roster: drops removed players; appends newly added players so they can bat/bowl. */
function syncLineupWithRoster(
  lineup: MatchLineup | undefined,
  homePlayers: RosterPlayer[],
  awayPlayers: RosterPlayer[],
): MatchLineup | undefined {
  if (!lineup) return undefined
  const homeIds = new Set(homePlayers.map((p) => p.playerId))
  const awayIds = new Set(awayPlayers.map((p) => p.playerId))
  const homeXI = lineup.homeXI.filter((id) => homeIds.has(id))
  const awayXI = lineup.awayXI.filter((id) => awayIds.has(id))
  for (const p of homePlayers) {
    if (!homeXI.includes(p.playerId)) homeXI.push(p.playerId)
  }
  for (const p of awayPlayers) {
    if (!awayXI.includes(p.playerId)) awayXI.push(p.playerId)
  }
  return { ...lineup, homeXI, awayXI }
}

export function MatchSquadsPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [match, setMatch] = useState<(MatchDoc & { id: string }) | null>(null)
  const [homePlayers, setHomePlayers] = useState<RosterPlayer[]>([])
  const [awayPlayers, setAwayPlayers] = useState<RosterPlayer[]>([])
  const [modalSide, setModalSide] = useState<'home' | 'away' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    const ref = doc(getDb(), 'matches', id)
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setMatch(null)
        return
      }
      const m = { id: snap.id, ...(snap.data() as MatchDoc) }
      setMatch(m)
      setHomePlayers(m.home.players)
      setAwayPlayers(m.away.players)
    })
  }, [id])

  if (!id) return <p>Missing id</p>
  if (!match) return <p>Loading…</p>

  if (!user || match.createdBy !== user.uid) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        <Link
          to={`/app/matches/${id}/score`}
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:underline',
            '!text-primary hover:!text-primary visited:!text-primary',
          )}
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
          Back to score
        </Link>
        <p className="mt-6 text-sm font-medium text-red-700">
          You can only edit squads for matches you created.
        </p>
      </div>
    )
  }

  const rosterForModal = modalSide === 'home' ? homePlayers : modalSide === 'away' ? awayPlayers : []
  const squadCap = match.squadSize

  function addPlayer(side: 'home' | 'away', p: RosterPlayer) {
    const cap = squadCap
    if (side === 'home') {
      setHomePlayers((prev) => {
        if (prev.some((x) => x.playerId === p.playerId)) return prev
        if (prev.length >= cap) return prev
        return [...prev, p]
      })
    } else {
      setAwayPlayers((prev) => {
        if (prev.some((x) => x.playerId === p.playerId)) return prev
        if (prev.length >= cap) return prev
        return [...prev, p]
      })
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!id || !match) return
    setError(null)
    if (homePlayers.length < MIN_PLAYERS || awayPlayers.length < MIN_PLAYERS) {
      setError(`Each side needs at least ${MIN_PLAYERS} players.`)
      return
    }
    if (homePlayers.length > match.squadSize || awayPlayers.length > match.squadSize) {
      setError(
        `This match allows at most ${match.squadSize} players per side. Remove extras before saving.`,
      )
      return
    }
    setSaving(true)
    try {
      const nextLineup = syncLineupWithRoster(match.lineup, homePlayers, awayPlayers)
      const home = { ...match.home, players: homePlayers }
      const away = { ...match.away, players: awayPlayers }
      await updateDoc(doc(getDb(), 'matches', id), {
        home,
        away,
        rosterPlayerIds: buildRosterPlayerIds(home, away),
        ...(nextLineup ? { lineup: nextLineup } : {}),
      })
      nav(`/app/matches/${id}/score`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save squads')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="match-squads-page mx-auto max-w-3xl px-4 pb-10 pt-4">
      <header className="mb-8 space-y-5">
        <Link
          to={`/app/matches/${id}/score`}
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:underline',
            '!text-primary hover:!text-primary visited:!text-primary',
          )}
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
          Back to score
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 leading-tight">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit playing squads</h1>
            <p className="mt-1 text-sm text-slate-500">
              {match.home.name} <span className="text-slate-400">vs</span> {match.away.name}
            </p>
          </div>
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden
          >
            <Users className="size-6" strokeWidth={2} />
          </div>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-slate-600">
          <p className="rounded-lg border border-slate-100 bg-slate-50/80 px-3.5 py-2.5 text-slate-700">
            Each side can include up to <strong className="text-slate-900">{match.squadSize}</strong> players (match
            squad size).
          </p>
          <p>
            Changes apply to this match only. For squads linked to{' '}
            <Link
              className="font-medium text-primary underline-offset-4 hover:underline"
              to="/app/teams"
            >
              My teams
            </Link>
            , you can also edit the saved team and use &quot;Refresh players from My teams&quot; before the toss.
          </p>
          {match.status === 'live' && (
            <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3.5 py-3 text-amber-950">
              This match is live. Avoid removing players who are currently batting, bowling, or already dismissed —
              scoring may reference them.
            </p>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {(['home', 'away'] as const).map((side) => {
          const label = side === 'home' ? match.home.name : match.away.name
          const players = side === 'home' ? homePlayers : awayPlayers
          const linked = side === 'home' ? match.home.userTeamId : match.away.userTeamId
          const removePlayer = (playerId: string) =>
            side === 'home'
              ? setHomePlayers((prev) => prev.filter((x) => x.playerId !== playerId))
              : setAwayPlayers((prev) => prev.filter((x) => x.playerId !== playerId))
          const atCap = players.length >= match.squadSize
          return (
            <div
              key={side}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="flex min-w-0 flex-1 items-center gap-3 pr-1">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                    aria-hidden
                  >
                    <Users className="size-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {label} squad
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Players available for this match. Changes apply here only.
                    </p>
                    {linked && (
                      <p className="mt-1 text-xs text-slate-500">
                        <Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/app/teams/${linked}`}>
                          Open linked My team
                        </Link>{' '}
                        to edit the saved squad.
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={atCap}
                  title={
                    atCap
                      ? `Maximum ${match.squadSize} players for this match — remove someone to add others`
                      : undefined
                  }
                  className="h-9 shrink-0 gap-1.5 rounded-lg border-primary bg-white px-2.5 text-xs font-semibold text-primary hover:bg-primary/5 sm:px-3 sm:text-sm"
                  onClick={() => setModalSide(side)}
                >
                  <Plus className="size-3.5 sm:size-4" strokeWidth={2.5} aria-hidden />
                  Add players
                </Button>
              </div>

              <p className="mt-3 text-sm font-semibold text-slate-600">
                {players.length}/{match.squadSize} player{players.length === 1 ? '' : 's'}
              </p>

              {players.length === 0 ? (
                <div className="mt-5 flex min-h-[120px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/40 px-4 py-6 text-center">
                  <div
                    className="mb-3 flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"
                    aria-hidden
                  >
                    <Users className="size-7" strokeWidth={1.75} />
                  </div>
                  <p className="font-semibold text-slate-900">No players yet</p>
                  <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-slate-500">
                    Tap Add players to build this match roster.
                  </p>
                </div>
              ) : (
                <ul className={`mt-3 list-none pl-0 ${SQUAD_SUMMARY_TILE_LIST_CLASS}`}>
                  {players.map((p) => (
                    <SquadSummaryTile key={p.playerId} name={p.name} onRemove={() => removePlayer(p.playerId)} />
                  ))}
                </ul>
              )}
            </div>
          )
        })}

        {error && <p className="error">{error}</p>}
        <div className="flex w-full flex-col-reverse gap-3 border-t border-slate-100 sm:flex-row">
          <Link
            to={`/app/matches/${id}/score`}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'inline-flex h-11 w-full min-w-0 items-center justify-center rounded-xl font-medium sm:flex-1',
            )}
          >
            Cancel
          </Link>
          <Button
            type="submit"
            disabled={saving}
            className="h-11 w-full min-w-0 rounded-xl font-semibold !text-primary-foreground sm:flex-1"
          >
            <BtnPendingLabel pending={saving} idle="Save squads" />
          </Button>
        </div>
      </form>

      <AddPlayersModal
        open={modalSide !== null}
        onClose={() => setModalSide(null)}
        roster={rosterForModal}
        maxRosterSize={squadCap}
        onAddPlayers={(players) => {
          if (!modalSide) return
          const cap = squadCap
          const cur = modalSide === 'home' ? homePlayers.length : awayPlayers.length
          const room = Math.max(0, cap - cur)
          players.slice(0, room).forEach((p) => addPlayer(modalSide, p))
        }}
      />
    </div>
  )
}
