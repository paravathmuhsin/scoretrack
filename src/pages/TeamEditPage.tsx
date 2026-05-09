import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { BtnPendingLabel } from '../components/Spinner'
import { getDb } from '../firebase/config'
import type { RosterPlayer, TeamDoc, TournamentDoc } from '../types/models'

export function TeamEditPage() {
  const { id, teamId } = useParams()
  const { user } = useAuth()
  const [tournament, setTournament] = useState<TournamentDoc | null>(null)
  const [team, setTeam] = useState<(TeamDoc & { id: string }) | null>(null)
  const [name, setName] = useState('')
  const [playersText, setPlayersText] = useState('')
  const [captainId, setCaptainId] = useState('')
  const [keeperId, setKeeperId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadState, setLoadState] = useState<'loading' | 'missing' | 'ready'>('loading')

  useEffect(() => {
    if (!id || !teamId) return
    setLoadState('loading')
    void (async () => {
      const tSnap = await getDoc(doc(getDb(), 'tournaments', id))
      const tmSnap = await getDoc(doc(getDb(), 'tournaments', id, 'teams', teamId))
      if (!tmSnap.exists()) {
        setTournament(null)
        setTeam(null)
        setLoadState('missing')
        return
      }
      const te = { id: tmSnap.id, ...(tmSnap.data() as TeamDoc) }
      setTeam(te)
      setName(te.name)
      setPlayersText(te.players.map((p) => p.name).join('\n'))
      setCaptainId(te.captainId ?? '')
      setKeeperId(te.keeperId ?? '')
      if (tSnap.exists()) {
        setTournament(tSnap.data() as TournamentDoc)
      } else {
        setTournament(null)
      }
      setLoadState('ready')
    })()
  }, [id, teamId])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!id || !teamId || !team) return
    setError(null)
    const names = playersText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (names.length < 2) {
      setError('Need at least two players.')
      return
    }
    const byName = new Map(team.players.map((p) => [p.name.trim(), p]))
    const players: RosterPlayer[] = names.map((n) => {
      const prev = byName.get(n)
      return prev ?? { playerId: crypto.randomUUID(), name: n }
    })
    const cap = captainId && players.some((p) => p.playerId === captainId) ? captainId : players[0]!.playerId
    const keep = keeperId && players.some((p) => p.playerId === keeperId) ? keeperId : players[1]!.playerId
    setSaving(true)
    try {
      await updateDoc(doc(getDb(), 'tournaments', id, 'teams', teamId), {
        name,
        captainId: cap,
        keeperId: keep,
        players,
        ...(team.organiserUid ? { organiserUid: team.organiserUid } : {}),
      } satisfies TeamDoc)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!id || !teamId) return <p>Missing route params</p>
  if (loadState === 'loading') return <p>Loading…</p>
  if (loadState === 'missing') return <p>Not found</p>
  if (!team) return <p>Loading…</p>

  const allowed =
    tournament != null
      ? tournament.createdBy === user?.uid
      : team.organiserUid === user?.uid
  if (!allowed) return <p>Not authorized</p>

  return (
    <div>
      <p>
        {tournament ? (
          <Link to={`/app/tournaments/${id}`}>← {tournament.name}</Link>
        ) : (
          <Link to="/app/tournaments">← My tournaments</Link>
        )}
      </p>
      {!tournament && (
        <p className="muted small">This tournament was deleted; the roster below is kept for reuse.</p>
      )}
      <h1>Edit team</h1>
      <form onSubmit={onSubmit} className="card">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Players (one per line — same name keeps id)
          <textarea rows={10} value={playersText} onChange={(e) => setPlayersText(e.target.value)} />
        </label>
        <label>
          Captain id
          <input value={captainId} onChange={(e) => setCaptainId(e.target.value)} />
        </label>
        <label>
          Keeper id
          <input value={keeperId} onChange={(e) => setKeeperId(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary" disabled={saving}>
          <BtnPendingLabel pending={saving} idle="Save" />
        </button>
      </form>
    </div>
  )
}
