import { collection, onSnapshot, query, where, type Timestamp } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { TournamentListingCard, type TournamentListingRow } from '../components/TournamentListingCard'
import { getDb } from '../firebase/config'
import type { TournamentDoc } from '../types/models'

/**
 * Public tournament directory (`/tournaments`): lists all **`isPublic === true`** tournaments.
 * No sign-in required; queries do **not** filter by `createdBy`.
 */

type Row = TournamentListingRow

function createdAtMs(at: TournamentDoc['createdAt']): number {
  if (!at || typeof at !== 'object') return 0
  const t = at as Timestamp
  if (typeof t.toMillis === 'function') return t.toMillis()
  return 0
}

function publicTournamentMetaRight(t: TournamentDoc): string {
  return t.teamCount != null && t.teamCount > 0 ? `${t.teamCount} teams` : 'Public'
}

export function PublicTournamentsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    /** Equality-only query avoids a composite index; order is applied client-side. */
    const qy = query(collection(getDb(), 'tournaments'), where('isPublic', '==', true))
    return onSnapshot(
      qy,
      (snap) => {
        const list: Row[] = []
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as TournamentDoc) }))
        list.sort((a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt))
        setRows(list)
        setError(null)
      },
      (err) => {
        console.error('[PublicTournamentsPage]', err)
        setRows([])
        setError(err.message ?? 'Could not load tournaments.')
      },
    )
  }, [])

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 py-2">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No public tournaments yet.</p>
      )}

      {!error && rows.length > 0 && (
        <ul className="space-y-4">
          {rows.map((t) => (
            <li key={t.id}>
              <TournamentListingCard t={t} to={`/tournaments/${t.id}`} metaRight={publicTournamentMetaRight(t)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
