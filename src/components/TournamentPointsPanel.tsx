import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getDb } from '../firebase/config'
import { recomputeTournament } from '../lib/recomputeTournament'
import type { StandingsDoc, TournamentDoc } from '../types/models'

type Props = {
  tournamentId: string
  /** `public` = browse tab on /tournaments/:id (card UI, no redundant heading). */
  variant?: 'fullPage' | 'embedded' | 'public'
}

/** Download icon — matches public live scorecard PDF control. */
function ScorecardPdfDownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  )
}

export function TournamentPointsPanel({ tournamentId: id, variant = 'embedded' }: Props) {
  const { user } = useAuth()
  const [tournament, setTournament] = useState<(TournamentDoc & { id: string }) | null>(null)
  const [standings, setStandings] = useState<StandingsDoc | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const ref = doc(getDb(), 'tournaments', id)
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setTournament(null)
        return
      }
      setTournament({ id: snap.id, ...(snap.data() as TournamentDoc) })
    })
  }, [id])

  useEffect(() => {
    if (!id) return
    const s1 = doc(getDb(), 'tournaments', id, 'standings', 'summary')
    return onSnapshot(s1, (snap) => setStandings(snap.exists() ? (snap.data() as StandingsDoc) : null))
  }, [id])

  async function refresh() {
    if (!id) return
    setError(null)
    try {
      await recomputeTournament(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recompute failed')
    }
  }

  async function exportPdf() {
    if (!tournament) return
    const [{ pdf }, { StatsPdfDocument }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('../pdf/StatsPdf'),
    ])
    const blob = await pdf(
      <StatsPdfDocument tournamentName={tournament.name} standings={standings} />,
    ).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `points-${id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!id) return <p className="muted">Missing tournament.</p>
  if (!tournament) return <p className="muted">Loading…</p>

  const canSee = tournament.isPublic || tournament.createdBy === user?.uid
  if (!canSee) return <p className="text-sm text-muted-foreground">Not authorized</p>

  const fullPage = variant === 'fullPage'
  const publicTab = variant === 'public'

  const tableInner = (
    <div className="tablewrap">
      <table className="table">
        <thead>
          <tr>
            <th>Team</th>
            <th>P</th>
            <th>W</th>
            <th>L</th>
            <th>NR</th>
            <th>Pts</th>
            <th>NRR</th>
          </tr>
        </thead>
        <tbody>
          {(standings?.teams ?? []).map((r) => (
            <tr key={r.teamId}>
              <td>{r.teamName}</td>
              <td>{r.played}</td>
              <td>{r.won}</td>
              <td>{r.lost}</td>
              <td>{r.nr ?? 0}</td>
              <td>{r.points}</td>
              <td>{r.nrr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div
      className={cn(
        !fullPage && 'tournament-points-panel',
        publicTab && 'tournament-stat-tab tournament-stat-tab--public',
      )}
    >
      {fullPage && (
        <>
          <p>
            <Link to={`/app/tournaments/${id}`}>← {tournament.name}</Link>
          </p>
          <h1>Points & stats</h1>
        </>
      )}
      <div
        className={publicTab ? 'tournament-stat-toolbar' : 'row'}
        style={publicTab ? undefined : { marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}
      >
        {tournament.createdBy === user?.uid &&
          (publicTab ? (
            <Button type="button" onClick={() => void refresh()}>
              Recompute from matches
            </Button>
          ) : (
            <button type="button" className="btn primary" onClick={() => void refresh()}>
              Recompute from matches
            </button>
          ))}
        {publicTab ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void exportPdf()}
            aria-label="Export points table PDF"
          >
            <ScorecardPdfDownloadIcon />
            Export PDF
          </Button>
        ) : (
          <button type="button" className="btn" onClick={() => void exportPdf()}>
            Export PDF
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}

      {!publicTab ? <h2 style={{ marginTop: fullPage ? undefined : 0 }}>Points table</h2> : null}
      {publicTab ? <div className="tournament-stat-table-card">{tableInner}</div> : tableInner}
    </div>
  )
}
