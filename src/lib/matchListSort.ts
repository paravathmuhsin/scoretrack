import type { MatchDoc, MatchStatus } from '../types/models'

function tsMs(t: unknown): number {
  if (t && typeof t === 'object' && 'toMillis' in t && typeof (t as { toMillis: unknown }).toMillis === 'function') {
    return (t as { toMillis: () => number }).toMillis()
  }
  return 0
}

export function scheduledMs(m: MatchDoc): number {
  return tsMs(m.scheduledAt)
}

export function startedMs(m: MatchDoc): number {
  return tsMs(m.startedAt)
}

export function completedAtMs(m: MatchDoc): number {
  return tsMs(m.completedAt)
}

/** Ascending timeline: scheduled first, else started, else completed (covers odd/legacy docs). */
export function operationalTimelineMs(m: MatchDoc): number {
  const s = scheduledMs(m)
  if (s > 0) return s
  const st = startedMs(m)
  if (st > 0) return st
  return completedAtMs(m)
}

/** Live → scheduled → completed → abandoned (matches “live, then upcoming, then done”). */
export function matchStatusBucketOrder(status: MatchStatus): number {
  switch (status) {
    case 'live':
      return 0
    case 'scheduled':
      return 1
    case 'completed':
      return 2
    case 'abandoned':
      return 3
    default:
      return 9
  }
}

/** Newest first: created time when present, otherwise scheduled time (legacy docs). */
export function latestFirstMs(m: MatchDoc): number {
  const c = m.createdAt
  if (c && typeof c === 'object' && 'toMillis' in c) {
    return (c as { toMillis: () => number }).toMillis()
  }
  return scheduledMs(m)
}

type Row = MatchDoc & { id: string }

/** Primary: status bucket; secondary: operational timeline ascending; tie: doc id. */
export function compareMatchesOperationalOrder(a: Row, b: Row): number {
  const ba = matchStatusBucketOrder(a.status)
  const bb = matchStatusBucketOrder(b.status)
  if (ba !== bb) return ba - bb
  const ta = operationalTimelineMs(a)
  const tb = operationalTimelineMs(b)
  if (ta !== tb) return ta - tb
  return a.id.localeCompare(b.id)
}
