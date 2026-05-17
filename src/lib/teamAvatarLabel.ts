import type { MatchTeamSnapshot } from '../types/models'

/** Prefer match snapshot `shortName`; otherwise full `name` (e.g. MVP team column). */
export function matchTeamShortLabel(team: Pick<MatchTeamSnapshot, 'name' | 'shortName'>): string {
  const s = team.shortName?.trim()
  return s || team.name
}

/**
 * Label for compact team avatar (e.g. score-live-side-avatar). Uses snapshot
 * `shortName` when set; otherwise initials from full `name`.
 */
export function teamAvatarLabel(team: Pick<MatchTeamSnapshot, 'name' | 'shortName'>): string {
  const sn = team.shortName?.trim()
  if (sn) {
    const parts = sn.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    }
    const one = (parts[0] ?? sn).toUpperCase()
    return one.length <= 3 ? one : one.slice(0, 3)
  }

  const nameParts = team.name.trim().split(/\s+/).filter(Boolean)
  if (nameParts.length >= 2) {
    return (nameParts[0]![0]! + nameParts[1]![0]!).toUpperCase()
  }
  return (nameParts[0] ?? '?').slice(0, 2).toUpperCase()
}

/** Avatar text for tournament team cards — uses `shortName` when set, else initials from `name`. */
export function tournTeamCardAvatarLabel(team: Pick<MatchTeamSnapshot, 'name' | 'shortName'>): string {
  return teamAvatarLabel(team)
}
