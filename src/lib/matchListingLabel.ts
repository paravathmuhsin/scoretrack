import type { MatchDoc } from '../types/models'

export type MatchListingLabelInput = Pick<
  MatchDoc,
  'tournamentId' | 'tournamentFixtureLabel' | 'isInternalMatch' | 'parentUserTeamRef' | 'venue'
>

/** Listing header line (home cards); tournament name passed when resolved from Firestore. */
export function resolveMatchListingMeta(
  match: MatchListingLabelInput,
  tournamentResolved?: string | null,
): string {
  if (match.tournamentId) {
    const interim = match.tournamentFixtureLabel?.trim() ?? ''
    return tournamentResolved ?? (interim || 'Tournament')
  }
  if (match.isInternalMatch) {
    const parentLabel = internalParentTeamLabel(match)
    return parentLabel ? `Internal · ${parentLabel}` : 'Internal'
  }
  return 'Friendly'
}

function internalParentTeamLabel(match: MatchListingLabelInput): string | null {
  const parent = match.parentUserTeamRef?.name?.trim()
  const short = match.parentUserTeamRef?.shortName?.trim()
  return parent || short || null
}

/** Live hero subtitle for non-tournament matches. */
export function resolvePublicLiveHeroLine(match: MatchListingLabelInput): string {
  if (match.tournamentId) return ''
  const venue = match.venue?.trim()
  if (match.isInternalMatch) {
    const parts = ['Internal']
    const parentLabel = internalParentTeamLabel(match)
    if (parentLabel) parts.push(parentLabel)
    if (venue) parts.push(venue)
    return parts.join(' · ')
  }
  return venue ? `Friendly · ${venue}` : 'Friendly'
}
