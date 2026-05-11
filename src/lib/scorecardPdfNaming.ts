import type { MatchDoc } from '../types/models'

/** Match **start** instant for naming: `startedAt` when play began, else `scheduledAt`. */
function matchPdfStartInstant(match: MatchDoc): Date | null {
  const ts = match.startedAt ?? match.scheduledAt
  if (!ts || typeof ts !== 'object' || typeof (ts as { toDate?: () => Date }).toDate !== 'function') {
    return null
  }
  const d = (ts as { toDate: () => Date }).toDate()
  return Number.isNaN(d.getTime()) ? null : d
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local `YYYY-MM-DD HH:mm` for PDF metadata / title. */
function dateTimePartForTitle(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** Local `YYYY-MM-DD HH-mm` (no `:`) for safe download filenames. */
function dateTimePartForFile(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}-${pad2(d.getMinutes())}`
}

/** Human-readable title / PDF metadata: `Team A vs Team B - YYYY-MM-DD HH:mm` (match start). */
export function scorecardPdfDisplayTitle(match: MatchDoc): string {
  const home = match.home.name.trim()
  const away = match.away.name.trim()
  const d = matchPdfStartInstant(match)
  const dateStr = d ? dateTimePartForTitle(d) : 'unknown-date'
  return `${home || 'Home'} vs ${away || 'Away'} - ${dateStr}`
}

function sanitizeFileSegment(s: string): string {
  const t = s
    .replace(/[/\\:*?"<>|#\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return t.length > 120 ? t.slice(0, 120).trim() : t
}

/** Safe download filename ending in `.pdf`. */
export function scorecardPdfDownloadFileName(match: MatchDoc & { id: string }): string {
  const home = sanitizeFileSegment(match.home.name) || 'Home'
  const away = sanitizeFileSegment(match.away.name) || 'Away'
  const d = matchPdfStartInstant(match)
  const dateStr = d ? dateTimePartForFile(d) : 'unknown-date'
  const base = `${home} vs ${away} - ${dateStr}`
  const safe = sanitizeFileSegment(base).replace(/\s+/g, ' ') || `scorecard-${match.id}`
  return `${safe}.pdf`
}
