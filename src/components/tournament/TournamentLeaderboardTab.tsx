import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { cn } from '@/lib/utils'
import type { StatsDoc, TournamentDoc } from '../../types/models'
import { getDb } from '../../firebase/config'

type BatMetric = 'runs' | 'highScore' | 'strikeRate' | 'sixes' | 'fours' | 'average'
type BowlMetric = 'wickets' | 'economy' | 'avgAgainst'
type Props = {
  tournamentId: string
  tournament: TournamentDoc & { id: string }
  /** Resolve linked-team id to display name */
  teamLabel?: (linkedTeamId: string) => string
  /** Public /tournaments/:id tab — card UI, no redundant section heading */
  publicListing?: boolean
}

export function TournamentLeaderboardTab({ tournamentId, tournament, teamLabel, publicListing }: Props) {
  const { user } = useAuth()
  const [stats, setStats] = useState<StatsDoc | null>(null)
  const [cat, setCat] = useState<'bat' | 'bowl' | 'field'>('bat')
  const [batMetric, setBatMetric] = useState<BatMetric>('runs')
  const [bowlMetric, setBowlMetric] = useState<BowlMetric>('wickets')

  useEffect(() => {
    const ref = doc(getDb(), 'tournaments', tournamentId, 'stats', 'summary')
    return onSnapshot(ref, (snap) => setStats(snap.exists() ? (snap.data() as StatsDoc) : null))
  }, [tournamentId])

  const players = stats?.players ?? []

  const batRows = useMemo(() => {
    const list = [...players]
    const minBalls = 10
    switch (batMetric) {
      case 'runs':
        list.sort((a, b) => b.runs - a.runs)
        return list.map((p) => ({
          name: p.name,
          teamId: p.teamId,
          val: p.runs,
          label: 'Runs',
        }))
      case 'highScore':
        list.sort((a, b) => (b.highScore ?? 0) - (a.highScore ?? 0))
        return list.map((p) => ({
          name: p.name,
          teamId: p.teamId,
          val: p.highScore ?? 0,
          label: 'High score',
        }))
      case 'strikeRate': {
        const q = list.filter((p) => p.balls >= minBalls)
        q.sort((a, b) => b.runs / b.balls - a.runs / a.balls)
        return q.map((p) => ({
          name: p.name,
          teamId: p.teamId,
          val: Math.round((p.runs / p.balls) * 1000) / 10,
          label: 'Strike rate',
        }))
      }
      case 'sixes':
        list.sort((a, b) => (b.sixes ?? 0) - (a.sixes ?? 0))
        return list.map((p) => ({
          name: p.name,
          teamId: p.teamId,
          val: p.sixes ?? 0,
          label: 'Sixes',
        }))
      case 'fours':
        list.sort((a, b) => (b.fours ?? 0) - (a.fours ?? 0))
        return list.map((p) => ({
          name: p.name,
          teamId: p.teamId,
          val: p.fours ?? 0,
          label: 'Fours',
        }))
      case 'average': {
        const withAvg = list.filter((p) => (p.dismissals ?? 0) > 0)
        withAvg.sort((a, b) => b.runs / (b.dismissals ?? 1) - a.runs / (a.dismissals ?? 1))
        return withAvg.map((p) => ({
          name: p.name,
          teamId: p.teamId,
          val: Math.round((p.runs / (p.dismissals ?? 1)) * 100) / 100,
          label: 'Average',
        }))
      }
      default:
        return []
    }
  }, [players, batMetric])

  const bowlRows = useMemo(() => {
    const list = [...players]
    const minOvers = 2
    switch (bowlMetric) {
      case 'wickets':
        list.sort((a, b) => b.wickets - a.wickets)
        return list.map((p) => ({
          name: p.name,
          teamId: p.teamId,
          val: p.wickets,
          label: 'Wickets',
        }))
      case 'economy': {
        const q = list.filter((p) => p.oversBowled >= minOvers)
        q.sort((a, b) => a.runsConceded / a.oversBowled - b.runsConceded / b.oversBowled)
        return q.map((p) => ({
          name: p.name,
          teamId: p.teamId,
          val: Math.round((p.runsConceded / p.oversBowled) * 100) / 100,
          label: 'Economy',
        }))
      }
      case 'avgAgainst': {
        const q = list.filter((p) => p.wickets > 0)
        q.sort((a, b) => a.runsConceded / a.wickets - b.runsConceded / b.wickets)
        return q.map((p) => ({
          name: p.name,
          teamId: p.teamId,
          val: Math.round((p.runsConceded / p.wickets) * 100) / 100,
          label: 'Runs per wicket',
        }))
      }
      default:
        return []
    }
  }, [players, bowlMetric])

  const fieldRows = useMemo(() => {
    const list = [...players]
    list.sort((a, b) => b.fieldingDismissals - a.fieldingDismissals)
    return list.map((p) => ({
      name: p.name,
      teamId: p.teamId,
      val: p.fieldingDismissals,
      label: 'Fielding assists',
    }))
  }, [players])

  const rows = cat === 'bat' ? batRows : cat === 'bowl' ? bowlRows : fieldRows

  const canSee = tournament.isPublic || tournament.createdBy === user?.uid
  if (!canSee) return <p className="text-sm text-muted-foreground">Not authorized</p>

  const labelTeam = (tid: string) => teamLabel?.(tid) ?? tid.slice(0, 8) + '…'

  const tableInner = (
    <div className="tablewrap">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Team</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 25).map((r, i) => (
            <tr key={`${r.name}-${r.teamId}-${i}`}>
              <td>{i + 1}</td>
              <td>{r.name}</td>
              <td className="muted small">{labelTeam(r.teamId)}</td>
              <td>
                {typeof r.val === 'number' && !Number.isInteger(r.val) ? r.val.toFixed(2) : r.val}{' '}
                <span className="muted small">({r.label})</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const tournamentEnded = Boolean(tournament.tournamentOutcome)

  return (
    <div className={cn(publicListing && 'tournament-stat-tab tournament-stat-tab--public tournament-leaderboard-tab')}>
      {publicListing ? null : <h2 className="tabs-panel-heading">Leaderboard</h2>}
      {!tournamentEnded && (
        <p className={publicListing ? 'tournament-stat-intro' : 'muted small'}>
          Stats are filled after matches complete and you run <strong>Recompute</strong> on the Point table tab. Fielding lists catches, run-outs, and stumpings credited from ball-by-ball data (combined).
        </p>
      )}
      <div
        className={cn('row', publicListing && 'tournament-stat-filters')}
        style={publicListing ? undefined : { gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}
      >
        <label>
          Category
          <select value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
            <option value="bat">Batting</option>
            <option value="bowl">Bowling</option>
            <option value="field">Fielding</option>
          </select>
        </label>
        {cat === 'bat' && (
          <label>
            Metric
            <select value={batMetric} onChange={(e) => setBatMetric(e.target.value as BatMetric)}>
              <option value="runs">Most runs</option>
              <option value="highScore">Highest score (innings)</option>
              <option value="strikeRate">Best strike rate (min 10 balls)</option>
              <option value="sixes">Most sixes</option>
              <option value="fours">Most fours</option>
              <option value="average">Best average</option>
            </select>
          </label>
        )}
        {cat === 'bowl' && (
          <label>
            Metric
            <select value={bowlMetric} onChange={(e) => setBowlMetric(e.target.value as BowlMetric)}>
              <option value="wickets">Most wickets</option>
              <option value="economy">Best economy (min 2 overs)</option>
              <option value="avgAgainst">Runs per wicket</option>
            </select>
          </label>
        )}
      </div>
      {!stats?.players?.length ? (
        <p className={cn('muted', publicListing && 'tournament-stat-empty')}>
          No stats yet — complete matches and recompute.
        </p>
      ) : publicListing ? (
        <div className="tournament-stat-table-card">{tableInner}</div>
      ) : (
        tableInner
      )}
    </div>
  )
}
