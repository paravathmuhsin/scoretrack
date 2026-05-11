import {
  bowlingStatsPerInnings,
  currentInnings,
  formatExtrasBreakdownLine,
  inningsExtrasBreakdownFromBalls,
  maidenCountsPerInnings,
  opp,
  oversProgressString,
  oversString,
  type InningsSnapshot,
  type ReplayConfig,
  type ReplayState,
  type ScoreEvent,
} from '../scoring/engine'
import { wicketsTimeline } from '../lib/publicLiveAnalytics'
import type { MatchDoc, RosterPlayer, Side } from '../types/models'

function nameFor(match: MatchDoc, pid: string): string {
  return (
    match.home.players.find((p) => p.playerId === pid)?.name ??
    match.away.players.find((p) => p.playerId === pid)?.name ??
    pid
  )
}

function xiPlayersInOrder(match: MatchDoc, side: Side): RosterPlayer[] {
  const xiIds = match.lineup?.[side === 'home' ? 'homeXI' : 'awayXI'] ?? []
  const pool = side === 'home' ? match.home.players : match.away.players
  const byId = new Map(pool.map((p) => [p.playerId, p]))
  const out: RosterPlayer[] = []
  for (const id of xiIds) {
    const p = byId.get(id)
    if (p) out.push(p)
  }
  return out
}

function inningsExtras(inn: InningsSnapshot, battingSide: Side, match: MatchDoc, state: ReplayState): number {
  const xi = xiPlayersInOrder(match, battingSide)
  let sumBat = 0
  for (const p of xi) {
    sumBat += state.batterStats[p.playerId]?.runs ?? 0
  }
  return Math.max(0, inn.runs - sumBat)
}

function bowlEcon(runs: number, legalBalls: number, ballsPerOver: number): string {
  if (legalBalls <= 0) return '0.00'
  const overs = legalBalls / ballsPerOver
  return (runs / overs).toFixed(2)
}

function ordinalWicket(n: number): string {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) return `${n}st`
  if (j === 2 && k !== 12) return `${n}nd`
  if (j === 3 && k !== 13) return `${n}rd`
  return `${n}th`
}

type Props = {
  match: MatchDoc & { id: string }
  cfg: ReplayConfig
  state: ReplayState
  events: ScoreEvent[]
}

export function ObsBowlingScorecard({ match, cfg, state, events }: Props) {
  const inn = currentInnings(state)
  const battingSide = inn.battingSide
  const bowlingSide = opp(battingSide)
  const teamName = (bowlingSide === 'home' ? match.home.name : match.away.name).toUpperCase()

  const subtitle =
    match.tournamentFixtureLabel?.trim() ||
    match.venue?.trim() ||
    'LIVE SCORECARD'

  const split = bowlingStatsPerInnings(cfg, events)
  const maidensSplit = maidenCountsPerInnings(cfg, events)
  const bucket = inn.innings === 1 ? split.innings1 : split.innings2
  const maidenBucket = inn.innings === 1 ? maidensSplit.innings1 : maidensSplit.innings2

  const xiBowl = xiPlayersInOrder(match, bowlingSide)

  const fow = wicketsTimeline(events, inn.innings, battingSide)

  const ext = inningsExtras(inn, battingSide, match, state)
  const comp = inningsExtrasBreakdownFromBalls(events, inn.innings, battingSide)
  const sumComp = comp.wd + comp.nb + comp.b + comp.lb
  const otherExtras = Math.max(0, ext - sumComp)
  const extrasDisplay = formatExtrasBreakdownLine(ext, comp, otherExtras)

  const oversDisp = oversProgressString(inn.legalBalls, cfg.ballsPerOver, cfg.oversLimit)
  const totalDisp = `${inn.runs}-${inn.wickets}`

  return (
    <div className="obs-sc obs-sc--bowling">
      <div className="obs-sc-frame">
        <div className="obs-sc-inner">
          <div className="obs-sc-head-primary">{teamName}</div>

          <div className="obs-sc-body-scroll" tabIndex={0}>
            <table className="obs-sc-table obs-sc-table--bowl">
              <caption className="obs-sc-visually-hidden">
                Bowling scorecard for {teamName}
              </caption>
              <colgroup>
                <col className="obs-sc-col-bowl-name" />
                <col className="obs-sc-col-bowl-o" />
                <col className="obs-sc-col-bowl-m" />
                <col className="obs-sc-col-bowl-r" />
                <col className="obs-sc-col-bowl-w" />
                <col className="obs-sc-col-bowl-e" />
              </colgroup>
              <thead>
                <tr className="obs-sc-thead-row obs-sc-thead-row--bowl">
                  <th scope="col" className="obs-sc-head-meta obs-sc-th-meta-bowl">
                    {subtitle}
                  </th>
                  <th scope="col" className="obs-sc-th obs-sc-th-o">
                    OVERS
                  </th>
                  <th scope="col" className="obs-sc-th obs-sc-th-m">
                    MAIDENS
                  </th>
                  <th scope="col" className="obs-sc-th obs-sc-th-r">
                    RUNS
                  </th>
                  <th scope="col" className="obs-sc-th obs-sc-th-w">
                    WKTS
                  </th>
                  <th scope="col" className="obs-sc-th obs-sc-th-e">
                    ECON
                  </th>
                </tr>
              </thead>
              <tbody>
                {xiBowl.length === 0 ? (
                  <tr className="obs-sc-row">
                    <td className="obs-sc-name" colSpan={6}>
                      No bowling lineup
                    </td>
                  </tr>
                ) : (
                  xiBowl.map((p) => {
                    const st = bucket[p.playerId] ?? { legalBalls: 0, runs: 0, wickets: 0 }
                    const mdn = maidenBucket[p.playerId] ?? 0
                    const ov = oversString(st.legalBalls, cfg.ballsPerOver)
                    const econ = bowlEcon(st.runs, st.legalBalls, cfg.ballsPerOver)
                    return (
                      <tr key={p.playerId} className="obs-sc-row">
                        <td className="obs-sc-name">{nameFor(match, p.playerId).toUpperCase()}</td>
                        <td className="obs-sc-bowl-num">{ov}</td>
                        <td className="obs-sc-bowl-num">{mdn}</td>
                        <td className="obs-sc-bowl-num">{st.runs}</td>
                        <td className="obs-sc-bowl-num">{st.wickets}</td>
                        <td className="obs-sc-bowl-num">{econ}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="obs-sc-fow">
            <span className="obs-sc-fow-label">FALL OF WICKETS</span>
            <div className="obs-sc-fow-chips">
              {fow.length === 0 ? (
                <span className="obs-sc-fow-empty">—</span>
              ) : (
                fow.map((f) => (
                  <div key={`${f.wickets}-${f.runs}-${f.dismissedId}`} className="obs-sc-fow-chip">
                    <span className="obs-sc-fow-ord">{ordinalWicket(f.wickets)}</span>
                    <span className="obs-sc-fow-score">{f.runs}</span>
                  </div>
                ))
              )}
            </div>
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
