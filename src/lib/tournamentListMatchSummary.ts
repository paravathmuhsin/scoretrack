import type { MatchDoc } from '../types/models'
import { compareMatchesOperationalOrder } from './matchListSort'

type MRow = MatchDoc & { id: string }

/** Leading row after operational sort (live → scheduled → …, then time asc). */
export function firstOperationalMatchRow(matches: MRow[] | undefined): MRow | null {
  if (!matches?.length) return null
  const c = [...matches]
  c.sort(compareMatchesOperationalOrder)
  return c[0] ?? null
}
