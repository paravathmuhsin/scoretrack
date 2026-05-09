import type { MatchDoc } from '../types/models'

/** Replace literal `home` / `away` in engine-style result lines with team names. */
export function humanizeResultSidesInText(text: string, homeName: string, awayName: string): string {
  return text
    .replace(/\bhome\b/gi, homeName)
    .replace(/\baway\b/gi, awayName)
}

export function humanizeResultForMatch(text: string, match: MatchDoc): string {
  return humanizeResultSidesInText(text, match.home.name, match.away.name)
}
