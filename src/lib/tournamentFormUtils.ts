import { Timestamp } from 'firebase/firestore'

/** HTML `input[type=date]` value (yyyy-mm-dd) → Firestore `Timestamp` (local calendar day, noon). */
export function dateInputToTimestamp(isoDate: string): Timestamp {
  const d = new Date(`${isoDate}T12:00:00`)
  return Timestamp.fromDate(d)
}

export function timestampToDateInput(ts: Timestamp | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return ''
  const d = ts.toDate()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatTournamentDate(ts: Timestamp | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return '—'
  return ts.toDate().toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Local date + time for match cards (scheduled / started). */
export function formatMatchDateTime(ts: Timestamp | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return ''
  return ts.toDate().toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
