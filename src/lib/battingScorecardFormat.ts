import type { InningsSnapshot, BatterDismissalSnap, BatterStatRow } from '../scoring/engine'
import type { MatchDoc } from '../types/models'

function nameFor(match: MatchDoc, playerId: string): string {
  return (
    match.home.players.find((p) => p.playerId === playerId)?.name ??
    match.away.players.find((p) => p.playerId === playerId)?.name ??
    playerId
  )
}

function normalizeHowOut(how: string): string {
  if (how === 'Stumped') return 'Stumping'
  return how
}

/** Caught-and-bowler: same player as fielder and bowler. */
function isCaughtAndBowled(
  d: BatterDismissalSnap | undefined,
  bowlerName: string,
  fielderDisp: string,
): boolean {
  if (!d?.bowlerId) return false
  if (d.fielderId && d.fielderId === d.bowlerId) return true
  const f = fielderDisp.trim()
  const b = bowlerName.trim()
  return Boolean(f && b && f === b)
}

/** Second-line extras from wides / no-balls when the wicket fell on an extra delivery. */
function dismissalExtrasParenthetical(d: BatterDismissalSnap): string | null {
  if (d.delivery === 'legal') return null
  const r = d.runsOnDelivery
  const parts: string[] = []
  if (d.delivery === 'noball') parts.push(`nb ${r}`)
  else if (d.delivery === 'wide') parts.push(`w ${r}`)
  return parts.length ? `(${parts.join(', ')})` : null
}

/**
 * Cricket-style batting detail under the name (public scorecard / PDF / overlay source):
 * `c Fielder b Bowler`, `c & b Bowler`, `ht b Bowler`, `retired`, `not out`, `b Bowler`,
 * `run out (Fielder)`, `st WK b Bowler`, plus extras `(nb 4)` / `(w 7)` when relevant.
 */
export function formatBattingScorecardStatus(
  match: MatchDoc,
  bs: BatterStatRow | undefined,
  inn: InningsSnapshot,
  playerId: string,
): string {
  if (inn.retiredOffField.has(playerId)) return 'retired'
  if (!bs?.out) return 'not out'

  const howRaw = bs.how ?? 'out'
  if (howRaw === 'Retired hurt') return 'retired'

  const how = normalizeHowOut(howRaw)
  const d = bs.dismissal
  const bowlerName = d ? nameFor(match, d.bowlerId) : '?'
  const fielderDisp =
    d?.fielderName?.trim() ||
    (d?.fielderId ? nameFor(match, d.fielderId) : '')

  let core = howRaw
  switch (how) {
    case 'Catch out':
      if (isCaughtAndBowled(d, bowlerName, fielderDisp)) {
        core = `c & b ${bowlerName}`
      } else {
        core = fielderDisp ? `c ${fielderDisp} b ${bowlerName}` : `c — b ${bowlerName}`
      }
      break
    case 'Bowled':
      core = `b ${bowlerName}`
      break
    case 'LBW':
      core = `lbw b ${bowlerName}`
      break
    case 'Stumping':
      core = fielderDisp ? `st ${fielderDisp} b ${bowlerName}` : `st — b ${bowlerName}`
      break
    case 'Run out':
      core = fielderDisp ? `run out (${fielderDisp})` : 'run out'
      break
    case 'Hit wicket':
      core = `ht b ${bowlerName}`
      break
    default:
      core = howRaw
      break
  }

  if (!d) return core

  const extras = dismissalExtrasParenthetical(d)
  if (!extras) return core

  return `${core}\n${extras}`
}
