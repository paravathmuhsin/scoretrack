import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { MatchDoc } from '../../types/models'

export function publicTournamentMatchKicker(status: MatchDoc['status']): string {
  switch (status) {
    case 'scheduled':
      return 'UPCOMING'
    case 'live':
      return 'LIVE'
    case 'completed':
      return 'RESULT'
    case 'abandoned':
      return 'ABANDONED'
    default:
      return String(status).toUpperCase()
  }
}

/** Fixture labels often end with "· Home vs Away"; teams are shown in the card — use venue / tournament location there instead. */
export function publicTournamentMatchHeadMeta(
  m: MatchDoc,
  tournamentLocation: string | null | undefined,
): string | null {
  const loc = (m.venue?.trim() || tournamentLocation?.trim() || '').trim()
  const raw = m.tournamentFixtureLabel?.trim()
  let parts = raw ? raw.split(' · ').map((s) => s.trim()).filter(Boolean) : []
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!
    if (/\s+vs\s+/i.test(last)) {
      parts = parts.slice(0, -1)
    }
  }
  let line = parts.length ? parts.join(' · ') : ''
  if (loc) {
    line = line ? `${line} · ${loc}` : loc
  }
  return line || null
}

export function OverviewDetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
}) {
  return (
    <div className="public-tournament-overview-row">
      <span className="public-tournament-overview-icon" aria-hidden>
        <Icon strokeWidth={2} />
      </span>
      <div className="public-tournament-overview-row-text">
        <span className="public-tournament-overview-label">{label}</span>
        <span className="public-tournament-overview-value">{children}</span>
      </div>
    </div>
  )
}
