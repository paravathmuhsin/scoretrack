import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { cn } from '@/lib/utils'
import type { StatsDoc, TournamentDoc } from '../../types/models'
import { getDb } from '../../firebase/config'

type Props = {
  tournamentId: string
  tournament: TournamentDoc & { id: string }
  teamLabel?: (linkedTeamId: string) => string
  publicListing?: boolean
}

export function TournamentMvpTab({ tournamentId, tournament, teamLabel, publicListing }: Props) {
  const { user } = useAuth()
  const [stats, setStats] = useState<StatsDoc | null>(null)

  useEffect(() => {
    const ref = doc(getDb(), 'tournaments', tournamentId, 'stats', 'summary')
    return onSnapshot(ref, (snap) => setStats(snap.exists() ? (snap.data() as StatsDoc) : null))
  }, [tournamentId])

  const rows = useMemo(() => {
    const list = [...(stats?.players ?? [])]
    list.sort((a, b) => b.mvpScore - a.mvpScore)
    return list
  }, [stats?.players])

  const canSee = tournament.isPublic || tournament.createdBy === user?.uid
  if (!canSee) return <p className="text-sm text-muted-foreground">Not authorized</p>

  const tlab = (tid: string) => teamLabel?.(tid) ?? tid.slice(0, 8) + '…'

  const tableInner = (
    <div className="tablewrap">
      <table className="table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Runs</th>
            <th>Wkts</th>
            <th>Team</th>
            <th>Ct</th>
            <th>RO</th>
            <th>St</th>
            <th>Fld</th>
            <th>POTM</th>
            <th>MVP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={`${p.playerId}-${p.teamId}`}>
              <td>{i + 1}</td>
              <td>{p.name}</td>
              <td>{p.runs}</td>
              <td>{p.wickets}</td>
              <td className="muted small">{tlab(p.teamId)}</td>
              <td>{p.catches ?? 0}</td>
              <td>{p.runOuts ?? 0}</td>
              <td>{p.stumpings ?? 0}</td>
              <td>{p.fieldingDismissals}</td>
              <td>{p.potmAwards ?? 0}</td>
              <td>
                <strong>{p.mvpScore}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className={cn(publicListing && 'tournament-stat-tab tournament-stat-tab--public tournament-mvp-tab')}>
      {publicListing ? null : <h2 className="tabs-panel-heading">MVP</h2>}
      <p className={publicListing ? 'tournament-stat-intro' : 'muted small'}>
        Tournament MVP sums the per-match fantasy formula (batting, bowling, fielding, impact bonuses).
        Run <strong>Recompute</strong> after matches complete.
      </p>
      {!rows.length ? (
        <p className={cn('muted', publicListing && 'tournament-stat-empty')}>No data yet.</p>
      ) : publicListing ? (
        <div className="tournament-stat-table-card">{tableInner}</div>
      ) : (
        tableInner
      )}
    </div>
  )
}
