import {
  currentInnings,
  formatExtrasBreakdownLine,
  inningsExtrasBreakdownFromBalls,
  oversString,
  type BatterStatRow,
  type InningsSnapshot,
  type ReplayConfig,
  type ReplayState,
  type ScoreEvent,
} from '../scoring/engine'
import { formatBattingScorecardStatus } from '../lib/battingScorecardFormat'
import type { MatchDoc, RosterPlayer, Side } from '../types/models'

function nameFor(match: MatchDoc, pid: string): string {
  return (
    match.home.players.find((p) => p.playerId === pid)?.name ??
    match.away.players.find((p) => p.playerId === pid)?.name ??
    pid
  )
}

/**
 * Full match squad for `side` on the overlay: batting XI first (same order as homeXI / awayXI),
 * then any other players on that team’s match roster (bench / unused squad).
 */
function squadPlayersBattingOrder(match: MatchDoc, side: Side): RosterPlayer[] {
  const pool = side === 'home' ? match.home.players : match.away.players
  const xiIds = match.lineup?.[side === 'home' ? 'homeXI' : 'awayXI'] ?? []
  const byId = new Map(pool.map((p) => [p.playerId, p]))
  const seen = new Set<string>()
  const out: RosterPlayer[] = []
  for (const id of xiIds) {
    const p = byId.get(id)
    if (p) {
      out.push(p)
      seen.add(id)
    }
  }
  for (const p of pool) {
    if (!seen.has(p.playerId)) out.push(p)
  }
  return out
}

function inningsExtras(inn: InningsSnapshot, battingSide: Side, match: MatchDoc, state: ReplayState): number {
  const squad = squadPlayersBattingOrder(match, battingSide)
  let sumBat = 0
  for (const p of squad) {
    sumBat += state.batterStats[p.playerId]?.runs ?? 0
  }
  return Math.max(0, inn.runs - sumBat)
}

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  const s = parts[0] ?? '?'
  return s.slice(0, 2).toUpperCase()
}

function overlayStatusLine(
  match: MatchDoc,
  bs: BatterStatRow | undefined,
  inn: InningsSnapshot,
  playerId: string,
): string {
  const raw = formatBattingScorecardStatus(match, bs, inn, playerId)
  if (raw.toLowerCase() === 'not out') return 'NOT OUT'
  return raw.replace(/\n/g, ' · ').toUpperCase()
}

/** Squad row: players who have not faced a ball this innings show “yet to bat”. */
function overlayBattingStatusCell(
  match: MatchDoc,
  bs: BatterStatRow | undefined,
  inn: InningsSnapshot,
  playerId: string,
): string {
  if (
    !inn.appearedBatIds.has(playerId) &&
    !inn.dismissed.has(playerId) &&
    !inn.retiredOffField.has(playerId)
  ) {
    return 'YET TO BAT'
  }
  return overlayStatusLine(match, bs, inn, playerId)
}

type Props = {
  match: MatchDoc & { id: string }
  cfg: ReplayConfig
  state: ReplayState
  events: ScoreEvent[]
}

export function ObsBattingScorecard({ match, cfg, state, events }: Props) {
  const inn = currentInnings(state)
  const battingSide = inn.battingSide
  const teamName = (battingSide === 'home' ? match.home.name : match.away.name).toUpperCase()

  const subtitle =
    match.tournamentFixtureLabel?.trim() ||
    match.venue?.trim() ||
    'LIVE SCORECARD'

  const squadBat = squadPlayersBattingOrder(match, battingSide)

  const ext = inningsExtras(inn, battingSide, match, state)
  const comp = inningsExtrasBreakdownFromBalls(events, inn.innings, battingSide)
  const sumComp = comp.wd + comp.nb + comp.b + comp.lb
  const otherExtras = Math.max(0, ext - sumComp)
  const extrasDisplay = formatExtrasBreakdownLine(ext, comp, otherExtras)

  const oversDisp = `${oversString(inn.legalBalls, cfg.ballsPerOver)}/${cfg.oversLimit}`
  const totalDisp = `${inn.runs}-${inn.wickets}`

  return (
    <div className="obs-sc">
      <div className="obs-sc-frame">
        <div className="obs-sc-logo" aria-hidden>
          <span className="obs-sc-logo-inner">{teamInitials(teamName)}</span>
        </div>

        <div className="obs-sc-inner">
          <div className="obs-sc-head-primary">{teamName}</div>

          <div className="obs-sc-body-scroll" tabIndex={0}>
            <table className="obs-sc-table">
              <caption className="obs-sc-visually-hidden">
                Batting scorecard for {teamName}
              </caption>
              <colgroup>
                <col className="obs-sc-col-name" />
                <col className="obs-sc-col-how" />
                <col className="obs-sc-col-runs" />
                <col className="obs-sc-col-balls" />
              </colgroup>
              <thead>
                <tr className="obs-sc-thead-row obs-sc-thead-row--bat">
                  <th colSpan={2} scope="colgroup" className="obs-sc-head-meta obs-sc-th-meta">
                    {subtitle}
                  </th>
                  <th scope="col" className="obs-sc-th obs-sc-th-runs">
                    RUNS
                  </th>
                  <th scope="col" className="obs-sc-th obs-sc-th-balls">
                    BALLS
                  </th>
                </tr>
              </thead>
              <tbody>
                {squadBat.length === 0 ? (
                  <tr className="obs-sc-row">
                    <td className="obs-sc-name" colSpan={4}>
                      No squad players
                    </td>
                  </tr>
                ) : (
                  squadBat.map((p) => {
                    const bs = state.batterStats[p.playerId]
                    const runs = bs?.runs ?? 0
                    const balls = bs?.balls ?? 0
                    const atCrease = inn.strikerId === p.playerId || inn.nonStrikerId === p.playerId
                    const status = overlayBattingStatusCell(match, bs, inn, p.playerId)
                    return (
                      <tr
                        key={p.playerId}
                        className={`obs-sc-row${atCrease ? ' obs-sc-row--live' : ''}`}
                      >
                        <td className="obs-sc-name">{nameFor(match, p.playerId).toUpperCase()}</td>
                        <td className="obs-sc-how">{status}</td>
                        <td className="obs-sc-runs">{runs}</td>
                        <td className="obs-sc-balls">{balls}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="obs-sc-footer">
            <span className="obs-sc-footer-cell">
              EXTRAS <strong>{extrasDisplay}</strong>
            </span>
            <span className="obs-sc-footer-cell obs-sc-footer-overs">
              OVERS <strong>{oversDisp}</strong>
            </span>
            <span className="obs-sc-footer-total">
              TOTAL <strong>{totalDisp}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
