import { useEffect, useMemo, useRef, useState } from 'react'
import {
  bowlingStatsPerInnings,
  currentInnings,
  formatExtrasBreakdownLine,
  inningsExtrasBreakdownFromBalls,
  inningsOversBallTimeline,
  opp,
  oversString,
  type InningsSnapshot,
  type PerInningsBowler,
  type ReplayConfig,
  type ReplayState,
  type ScoreEvent,
} from '../scoring/engine'
import { PlayerRoleMarkers } from './PlayerRoleMarkers'
import { Spinner } from './Spinner'
import { humanizeResultForMatch } from '../lib/humanizeResultText'
import { usePublicLiveHeroMeta } from '../hooks/usePublicLiveHeroMeta'
import { computeMatchMvp } from '../lib/mvpMatch'
import { cn } from '@/lib/utils'
import { scoreLineForSide } from '../lib/scoreLineFormat'
import { formatBattingScorecardStatus } from '../lib/battingScorecardFormat'
import { playerRoleMarkersPlain } from '../lib/matchPlayerRoles'
import {
  partnershipSinceLastWicket,
  shortName,
  wicketsTimeline,
  type FallOfWicketInfo,
} from '../lib/publicLiveAnalytics'
import type { MatchDoc, Side } from '../types/models'

type Props = {
  match: MatchDoc & { id: string }
  cfg: ReplayConfig
  state: ReplayState
  events: ScoreEvent[]
}

type NavId = 'live' | 'scorecard' | 'mvp'

const NAV: { id: NavId; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'mvp', label: 'MVP' },
]

function nameFor(match: MatchDoc, pid: string): string {
  return (
    match.home.players.find((p) => p.playerId === pid)?.name ??
    match.away.players.find((p) => p.playerId === pid)?.name ??
    pid
  )
}

function xiPlayers(match: MatchDoc, side: Side) {
  const xi = match.lineup?.[side === 'home' ? 'homeXI' : 'awayXI'] ?? []
  const pool = side === 'home' ? match.home.players : match.away.players
  return pool.filter((p) => xi.includes(p.playerId))
}

function sr(runs: number, balls: number): string {
  if (balls <= 0) return '—'
  return String(Math.round((runs / balls) * 100))
}

function economy(runs: number, legalBalls: number, ballsPerOver: number): string {
  if (legalBalls <= 0) return '0.00'
  const overs = legalBalls / ballsPerOver
  return (runs / overs).toFixed(2)
}

function bowlerOversDisplay(legalBalls: number, ballsPerOver: number): string {
  if (legalBalls <= 0) return '0'
  return oversString(legalBalls, ballsPerOver)
}

function tossLine(match: MatchDoc): string | null {
  if (!match.toss) return null
  const winner = match.toss.winnerSide === 'home' ? match.home.name : match.away.name
  const el = match.toss.elected === 'bat' ? 'bat' : 'bowl'
  return `${winner} chose to ${el}`
}

function crr(inn: InningsSnapshot, ballsPerOver: number): string {
  if (inn.legalBalls <= 0) return '—'
  const overs = inn.legalBalls / ballsPerOver
  return (inn.runs / overs).toFixed(2)
}

function inningsExtras(inn: InningsSnapshot, battingSide: Side, match: MatchDoc, state: ReplayState): number {
  const xi = xiPlayers(match, battingSide)
  let sumBat = 0
  for (const p of xi) {
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

/** Cricket-style * for batters still in (not dismissed, not retired hurt off the field). */
function notOutAsterisk(
  bs: { out?: boolean; how?: string } | undefined,
  inn: InningsSnapshot,
  playerId: string,
): boolean {
  if (inn.dismissed.has(playerId)) return false
  if (inn.retiredOffField.has(playerId)) return false
  if (bs?.out) return false
  return true
}

/** Live match + active innings on scorecard: * only on striker. Completed or past innings: * on all not-out. */
function showBatterNotOutStar(
  matchComplete: boolean,
  viewingInnings: 1 | 2,
  activeInnings: 1 | 2,
  innSnap: InningsSnapshot,
  bs: { out?: boolean; how?: string } | undefined,
  playerId: string,
): boolean {
  if (!notOutAsterisk(bs, innSnap, playerId)) return false
  if (!matchComplete && viewingInnings === activeInnings) {
    return playerId === innSnap.strikerId
  }
  return true
}

function ballTimelineClass(sym: string): string {
  const base = 'public-live-ball'
  if (sym.startsWith('+')) return `${base} ${base}--extra`
  if (sym === 'Rh') return `${base} ${base}--retired-hurt`
  if (sym === 'W' || sym === 'w') return `${base} ${base}--wicket`
  if (sym.startsWith('Wd') && sym.endsWith('W')) return `${base} ${base}--wicket`
  if (sym.startsWith('Nb') && sym.includes('W')) return `${base} ${base}--wicket`
  if (sym === '⇄') return `${base} ${base}--swap`
  if (sym.startsWith('Wd') || sym.startsWith('Nb')) return base
  const n = Number.parseInt(sym, 10)
  if (!Number.isNaN(n)) {
    if (n === 4) return `${base} ${base}--four`
    if (n === 6) return `${base} ${base}--six`
    return `${base} ${base}--runs`
  }
  return base
}

function formatFallOfWicketEntry(
  match: MatchDoc,
  battingSide: Side,
  f: FallOfWicketInfo,
  ballsPerOver: number,
): string {
  const nm =
    nameFor(match, f.dismissedId) + playerRoleMarkersPlain(match, battingSide, f.dismissedId)
  return `${f.wickets}-${f.runs} (${nm}, ${oversString(f.legalBalls, ballsPerOver)} ov)`
}

function inningsRunRateDisplay(runs: number, legalBalls: number, ballsPerOver: number): string {
  if (legalBalls <= 0) return '—'
  const overs = legalBalls / ballsPerOver
  return (runs / overs).toFixed(2)
}

function ordinalOverLabel(n: number): string {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) return `${n}st`
  if (j === 2 && k !== 12) return `${n}nd`
  if (j === 3 && k !== 13) return `${n}rd`
  return `${n}th`
}

export function PublicLiveScorecardDetail({ match, cfg, state, events }: Props) {
  const [mainTab, setMainTab] = useState<NavId>(() => (state.matchComplete ? 'scorecard' : 'live'))
  const [inningsPick, setInningsPick] = useState<1 | 2>(1)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const completeOnce = useRef(false)

  async function downloadScorecardPdf() {
    setPdfError(null)
    setPdfGenerating(true)
    try {
      const [{ pdf }, { ScorecardPdfDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../pdf/ScorecardPdf'),
      ])
      const blob = await pdf(
        <ScorecardPdfDocument match={match} state={state} cfg={cfg} events={events} />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `scorecard-${match.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Could not export PDF')
    } finally {
      setPdfGenerating(false)
    }
  }

  useEffect(() => {
    if (state.matchComplete && !completeOnce.current) {
      completeOnce.current = true
      setMainTab('scorecard')
    }
  }, [state.matchComplete])

  useEffect(() => {
    if (state.matchComplete && mainTab === 'live') {
      setMainTab('scorecard')
    }
  }, [state.matchComplete, mainTab])

  const navItems = useMemo(
    () => (state.matchComplete ? NAV.filter((n) => n.id !== 'live') : NAV),
    [state.matchComplete],
  )

  const splitBowling = useMemo(() => bowlingStatsPerInnings(cfg, events), [cfg, events])

  const hasInnings2 = state.innings2 !== null
  const inn1Bat = state.innings1.battingSide
  const inn2Bat = state.innings2?.battingSide

  const battingSideForTab: Side | null = inningsPick === 1 ? inn1Bat : inn2Bat ?? null
  const innSnap: InningsSnapshot | null =
    inningsPick === 1 ? state.innings1 : state.innings2 ?? null

  const liveInn = currentInnings(state)

  const partnership = useMemo(() => {
    if (state.matchComplete) return null
    return partnershipSinceLastWicket(events, liveInn.innings, liveInn.battingSide)
  }, [events, liveInn.battingSide, liveInn.innings, state.matchComplete])

  const falls = useMemo(
    () => wicketsTimeline(events, liveInn.innings, liveInn.battingSide),
    [events, liveInn.battingSide, liveInn.innings],
  )

  const scorecardFow = useMemo(() => {
    if (!battingSideForTab) return []
    return wicketsTimeline(events, inningsPick, battingSideForTab)
  }, [battingSideForTab, events, inningsPick])

  const lastFall = falls.length ? falls[falls.length - 1] : null
  const partnershipRR =
    partnership && partnership.legalBalls > 0
      ? ((partnership.runs / partnership.legalBalls) * cfg.ballsPerOver).toFixed(2)
      : '—'

  const heroMetaLine = usePublicLiveHeroMeta(match)

  const detail = useMemo(() => {
    if (!innSnap || !battingSideForTab) return null
    const bowlingSide = opp(battingSideForTab)
    const xiBat = xiPlayers(match, battingSideForTab)
    const agg = inningsPick === 1 ? splitBowling.innings1 : splitBowling.innings2

    const batted: typeof xiBat = []
    const yetTo: typeof xiBat = []
    for (const p of xiBat) {
      const bs = state.batterStats[p.playerId]
      const isOut = bs?.out
      const onCrease =
        innSnap.strikerId === p.playerId || innSnap.nonStrikerId === p.playerId
      const touched =
        (bs && (bs.balls > 0 || bs.runs > 0)) ||
        isOut ||
        onCrease ||
        innSnap.retiredOffField.has(p.playerId)
      if (touched) batted.push(p)
      else yetTo.push(p)
    }

    const bowlRows: { id: string; name: string; stats: PerInningsBowler }[] = []
    const bowlingXiIds = new Set(xiPlayers(match, bowlingSide).map((p) => p.playerId))
    for (const [id, st] of Object.entries(agg)) {
      if (!bowlingXiIds.has(id) || (st.legalBalls === 0 && st.runs === 0 && st.wickets === 0)) continue
      bowlRows.push({ id, name: nameFor(match, id), stats: st })
    }
    bowlRows.sort((a, b) => b.stats.legalBalls - a.stats.legalBalls)

    const ext = inningsExtras(innSnap, battingSideForTab, match, state)
    const comp = inningsExtrasBreakdownFromBalls(events, inningsPick, battingSideForTab)
    const sumComp = comp.wd + comp.nb + comp.b + comp.lb
    const otherExtras = Math.max(0, ext - sumComp)
    const extrasDisplay = formatExtrasBreakdownLine(ext, comp, otherExtras)

    return { bowlingSide, batted, yetTo, bowlRows, extrasDisplay }
  }, [events, innSnap, battingSideForTab, inningsPick, match, splitBowling, state])

  /** Live panel: batters at the crease in XI order (striker marked with *). */
  const liveBattersOrdered = useMemo(() => {
    if (state.matchComplete) return []
    const inn = liveInn
    const xi = xiPlayers(match, inn.battingSide)
    const atCrease = new Set([inn.strikerId, inn.nonStrikerId])
    return xi.filter((p) => atCrease.has(p.playerId))
  }, [liveInn, match, state.matchComplete])

  const liveBallTimeline = useMemo(
    () => inningsOversBallTimeline(cfg, events, liveInn.innings, liveInn.battingSide),
    [cfg, events, liveInn.innings, liveInn.battingSide],
  )

  const liveBowlRows = useMemo(() => {
    if (!detail || state.matchComplete) return []
    const agg =
      liveInn.innings === 1 ? splitBowling.innings1 : splitBowling.innings2
    const bowlingSide = opp(liveInn.battingSide)
    const bowlingXiIds = new Set(xiPlayers(match, bowlingSide).map((p) => p.playerId))
    const rows: { id: string; name: string; stats: PerInningsBowler }[] = []
    for (const [id, st] of Object.entries(agg)) {
      if (!bowlingXiIds.has(id) || (st.legalBalls === 0 && st.runs === 0 && st.wickets === 0)) continue
      rows.push({ id, name: nameFor(match, id), stats: st })
    }
    rows.sort((a, b) => {
      if (a.id === liveInn.bowlerId) return -1
      if (b.id === liveInn.bowlerId) return 1
      return b.stats.legalBalls - a.stats.legalBalls
    })
    return rows
  }, [detail, liveInn, match, splitBowling, state.matchComplete])

  const mvp = useMemo(() => computeMatchMvp(match, cfg, events, state), [match, cfg, events, state])

  const chaseLive = useMemo(() => {
    if (state.matchComplete || liveInn.innings !== 2) return null
    const target = state.innings1.runs + 1
    const runsReq = Math.max(0, target - liveInn.runs)
    const cap = cfg.oversLimit * cfg.ballsPerOver
    const ballsLeft = Math.max(0, cap - liveInn.legalBalls)
    let rrr: string
    if (runsReq === 0) rrr = '0.00'
    else if (ballsLeft <= 0) rrr = '—'
    else {
      const oversEq = ballsLeft / cfg.ballsPerOver
      rrr = (runsReq / oversEq).toFixed(2)
    }
    return { target, runsReq, ballsLeft, rrr }
  }, [
    state.matchComplete,
    liveInn.innings,
    liveInn.runs,
    liveInn.legalBalls,
    state.innings1.runs,
    cfg.oversLimit,
    cfg.ballsPerOver,
  ])

  const liveChaseStripText = useMemo(() => {
    if (!chaseLive || state.matchComplete || state.activeInnings !== 2 || !state.innings2) return null
    const battingNow = state.innings2.battingSide === 'home' ? match.home.name : match.away.name
    if (chaseLive.runsReq === 0) return 'Target reached'
    if (chaseLive.ballsLeft > 0) {
      return `${battingNow} need ${chaseLive.runsReq} ${chaseLive.runsReq === 1 ? 'run' : 'runs'} from ${chaseLive.ballsLeft} ${chaseLive.ballsLeft === 1 ? 'ball' : 'balls'}`
    }
    return `${battingNow} need ${chaseLive.runsReq} ${chaseLive.runsReq === 1 ? 'run' : 'runs'}`
  }, [
    chaseLive,
    state.matchComplete,
    state.activeInnings,
    state.innings2,
    match.home.name,
    match.away.name,
  ])

  const completedInningsSideForSummary: Side | null =
    state.innings2 && !state.matchComplete ? state.innings1.battingSide : null

  return (
    <div className="public-live-detail">
      {(heroMetaLine || !state.matchComplete) && (
        <header className="public-live-page-header">
          <div className="public-live-page-title-row">
            {heroMetaLine ? <p className="public-live-page-kicker">{heroMetaLine}</p> : null}
            {!state.matchComplete && (
              <span className="public-live-livebadge" aria-live="polite">
                <span className="public-live-livepulse" aria-hidden />
                LIVE
              </span>
            )}
          </div>
        </header>
      )}

      <div className="card score-live-summary public-live-score-card">
        <div className="score-live-summary-top">
          <div
            className={cn(
              'score-live-side score-live-side--home',
              completedInningsSideForSummary === 'home' && 'score-live-side--completed-innings',
            )}
          >
            <span className="score-live-side-label">{match.home.name}</span>
            <div className="score-live-side-main">
              <span className="score-live-side-avatar">{teamInitials(match.home.name)}</span>
              <div className="score-live-side-score">{scoreLineForSide(state, cfg, 'home')}</div>
            </div>
          </div>
          <div className="score-live-vs">VS</div>
          <div
            className={cn(
              'score-live-side score-live-side--away',
              completedInningsSideForSummary === 'away' && 'score-live-side--completed-innings',
            )}
          >
            <span className="score-live-side-label">{match.away.name}</span>
            <div className="score-live-side-main">
              <span className="score-live-side-avatar score-live-side-avatar--away">
                {teamInitials(match.away.name)}
              </span>
              <div className="score-live-side-score">{scoreLineForSide(state, cfg, 'away')}</div>
            </div>
          </div>
        </div>

        {!state.matchComplete && (
          <div className="score-live-crr">
            <span className="score-live-crr-label">CRR</span>
            <span className="score-live-crr-val">{crr(liveInn, cfg.ballsPerOver)}</span>
            {state.innings2 && chaseLive && (
              <>
                <span className="score-live-crr-sep">·</span>
                <span className="score-live-crr-label">RR</span>
                <span className="score-live-crr-val">{chaseLive.rrr}</span>
              </>
            )}
          </div>
        )}

        {state.matchComplete && (
          <>
            <p className="score-live-result">
              {humanizeResultForMatch(
                match.resultSummary?.text ?? state.resultText ?? 'Match complete',
                match,
              )}
            </p>
            {match.resultSummary?.endReason && (
              <p className="muted small" style={{ marginTop: '0.35rem' }}>
                <strong>Reason:</strong> {match.resultSummary.endReason}
              </p>
            )}
          </>
        )}

        {!state.matchComplete && liveChaseStripText && (
          <div className="score-live-chase-strip">{liveChaseStripText}</div>
        )}
      </div>

      {tossLine(match) ? <p className="public-live-toss-line muted small">{tossLine(match)}</p> : null}

      <nav id="public-live-nav" className="public-live-nav-strip" aria-label="Match views">
        <div className="public-live-nav-row">
          <div className="public-live-nav-inner">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  'public-live-nav-pill' + (mainTab === item.id ? ' public-live-nav-pill--active' : '')
                }
                onClick={() => setMainTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {state.matchComplete && (
            <button
              type="button"
              className="btn ghost public-live-nav-pdf"
              disabled={pdfGenerating}
              onClick={() => void downloadScorecardPdf()}
              aria-label={pdfGenerating ? 'Generating PDF' : 'Download scorecard PDF'}
            >
              {pdfGenerating ? (
                <Spinner size="sm" label="Generating PDF" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
              )}
            </button>
          )}
        </div>
      </nav>
      {state.matchComplete && pdfError && (
        <p className="error small public-live-pdf-error" role="alert">
          {pdfError}
        </p>
      )}

      {mainTab === 'live' && !state.matchComplete && (
        <>
          <div className="card score-live-stats public-live-score-card">
            <div className="score-live-stats-section score-live-stats-section--batting">
              <table className="score-live-table score-live-table--batting">
                  <thead>
                    <tr>
                      <th>Batsman</th>
                      <th className="num">R</th>
                      <th className="num">B</th>
                      <th className="num">4s</th>
                      <th className="num">6s</th>
                      <th className="num">SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveBattersOrdered.map((p) => {
                      const bs = state.batterStats[p.playerId]
                      const runs = bs?.runs ?? 0
                      const balls = bs?.balls ?? 0
                      const active =
                        p.playerId === liveInn.strikerId || p.playerId === liveInn.nonStrikerId
                      return (
                        <tr key={p.playerId} className={active ? 'public-live-row-active' : undefined}>
                          <td className="score-live-name">
                            <div>
                              {p.name}
                              <PlayerRoleMarkers match={match} side={liveInn.battingSide} playerId={p.playerId} />
                              {showBatterNotOutStar(
                                state.matchComplete,
                                liveInn.innings,
                                state.activeInnings as 1 | 2,
                                liveInn,
                                bs,
                                p.playerId,
                              )
                                ? '*'
                                : ''}
                            </div>
                          </td>
                          <td className="num score-live-runs">{runs}</td>
                          <td className="num muted">{balls}</td>
                          <td className="num muted">{bs?.fours ?? 0}</td>
                          <td className="num muted">{bs?.sixes ?? 0}</td>
                          <td className="num muted">{sr(runs, balls)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
              </table>
            </div>
            <div className="score-live-stats-section score-live-stats-section--bowling">
              <table className="score-live-table score-live-table--bowling">
                  <thead>
                    <tr>
                      <th>Bowler</th>
                      <th className="num">O</th>
                      <th className="num">M</th>
                      <th className="num">R</th>
                      <th className="num">W</th>
                      <th className="num">ER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveBowlRows.map(({ id, name, stats }) => (
                      <tr key={id} className={id === liveInn.bowlerId ? 'public-live-row-active' : undefined}>
                        <td className="score-live-name">
                          <div>
                            {name}
                            <PlayerRoleMarkers match={match} side={opp(liveInn.battingSide)} playerId={id} />
                          </div>
                        </td>
                        <td className="num muted">{bowlerOversDisplay(stats.legalBalls, cfg.ballsPerOver)}</td>
                        <td className="num muted">0</td>
                        <td className="num muted">{stats.runs}</td>
                        <td className="num muted">{stats.wickets}</td>
                        <td className="num muted">{economy(stats.runs, stats.legalBalls, cfg.ballsPerOver)}</td>
                      </tr>
                    ))}
                  </tbody>
              </table>
            </div>
          </div>

          <footer className="public-live-context public-live-soft-panel muted small">
            {partnership && (
              <p>
                <strong>Partnership:</strong> {partnership.runs} runs, {partnership.legalBalls} balls (RR:{' '}
                {partnershipRR})
              </p>
            )}
            {lastFall && (
              <p>
                <strong>Last wicket:</strong>{' '}
                <span className="public-live-fow-name">
                  {nameFor(match, lastFall.dismissedId)}
                  <PlayerRoleMarkers match={match} side={liveInn.battingSide} playerId={lastFall.dismissedId} />
                </span>{' '}
                ·{' '}
                <strong>FOW:</strong> {lastFall.runs}/{lastFall.wickets} (
                {oversString(lastFall.legalBalls, cfg.ballsPerOver)} ov)
              </p>
            )}
          </footer>

          <section className="public-live-timeline-section public-live-soft-panel">
            <div className="public-live-timeline-head">
              <span className="public-live-timeline-title">Recent balls</span>
              <span className="muted small">Latest → left</span>
            </div>
            <div className="public-live-timeline-scroll">
              {liveBallTimeline.partial &&
                liveBallTimeline.partial.symbols
                  .slice()
                  .reverse()
                  .map((sym, i) => (
                    <span key={`p-${sym}-${i}`} className={ballTimelineClass(sym)}>
                      {sym}
                    </span>
                  ))}
              {[...liveBallTimeline.completed].reverse().map((over) => (
                <div key={over.overNumber} className="public-live-over-block">
                  <div className="public-live-over-sep" role="presentation" aria-hidden>
                    <span className="public-live-over-sep-line" />
                    <div className="public-live-over-sep-mid">
                      <span className="public-live-over-sep-ordinal">{ordinalOverLabel(over.overNumber)}</span>
                      <span className="public-live-over-sep-runs">{over.runsInOver} runs</span>
                    </div>
                    <span className="public-live-over-sep-line" />
                  </div>
                  {over.symbols
                    .slice()
                    .reverse()
                    .map((sym, i) => (
                      <span key={`${over.overNumber}-${sym}-${i}`} className={ballTimelineClass(sym)}>
                        {sym}
                      </span>
                    ))}
                </div>
              ))}
              {!liveBallTimeline.partial && liveBallTimeline.completed.length === 0 && (
                <span className="muted small">No balls yet</span>
              )}
            </div>
          </section>
        </>
      )}

      {mainTab === 'mvp' && (
        <section className="public-live-mvp public-live-tab-panel" aria-labelledby="public-live-mvp-title">
          <h3 id="public-live-mvp-title" className="public-live-table-title">
            Most Valuable Player (MVP)
          </h3>
          {state.matchComplete && mvp.potm && (
            <div className="public-live-mvp-potm" role="status">
              <span className="public-live-mvp-potm-label">Player of the Match</span>
              <span className="public-live-mvp-potm-name">{mvp.potm.name}</span>
              <span className="muted small public-live-mvp-potm-team">
                {mvp.potm.side === 'home' ? match.home.name : match.away.name}
              </span>
              {mvp.potmNote ? <p className="public-live-mvp-potm-note muted small">{mvp.potmNote}</p> : null}
            </div>
          )}
          {!state.matchComplete && (
            <p className="muted small public-live-mvp-livehint">
              Live match — standings update with each ball. Player of the Match is awarded when the
              match finishes.
            </p>
          )}
          {mvp.rows.length === 0 ? (
            <p className="muted small">No squad line-ups on file; MVP cannot be computed.</p>
          ) : (
            <div className="public-live-tablewrap">
              <table className="public-live-table public-live-mvp-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th className="num">Bat</th>
                    <th className="num">Bowl</th>
                    <th className="num">Fld</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {mvp.rows.map((r) => (
                    <tr
                      key={r.playerId}
                      className={
                        state.matchComplete && mvp.potm?.playerId === r.playerId
                          ? 'public-live-mvp-row-potm'
                          : undefined
                      }
                    >
                      <td>
                        <span className="public-live-batter-name">{shortName(r.name, 28)}</span>
                        <PlayerRoleMarkers match={match} side={r.side} playerId={r.playerId} />
                        <span className="muted small public-live-mvp-side">
                          {' '}
                          ({r.side === 'home' ? match.home.name : match.away.name})
                        </span>
                      </td>
                      <td className="num">{r.batting.toFixed(2)}</td>
                      <td className="num">{r.bowling.toFixed(2)}</td>
                      <td className="num">{r.fielding.toFixed(2)}</td>
                      <td className="num public-live-mvp-total">{r.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {mainTab === 'scorecard' && detail && innSnap && battingSideForTab && (
        <div className="public-live-tab-panel">
          <div className="public-live-innings-tabs">
            <button
              type="button"
              className={
                'public-live-inn-tab' +
                (inningsPick === 1 ? ' public-live-inn-tab--on' : '')
              }
              onClick={() => setInningsPick(1)}
            >
              {inn1Bat === 'home' ? match.home.name : match.away.name}
            </button>
            <button
              type="button"
              disabled={!hasInnings2}
              className={
                'public-live-inn-tab' +
                (inningsPick === 2 ? ' public-live-inn-tab--on' : '') +
                (!hasInnings2 ? ' public-live-inn-tab--disabled' : '')
              }
              onClick={() => hasInnings2 && setInningsPick(2)}
            >
              {hasInnings2 && inn2Bat ? (inn2Bat === 'home' ? match.home.name : match.away.name) : 'Innings 2'}
            </button>
          </div>

          <div className="public-live-tablewrap">
            <h4 className="public-live-table-title">Batting</h4>
            <table className="public-live-table">
              <thead>
                <tr>
                  <th>Batting</th>
                  <th className="num">R</th>
                  <th className="num">B</th>
                  <th className="num">4s</th>
                  <th className="num">6s</th>
                  <th className="num">S/R</th>
                </tr>
              </thead>
              <tbody>
                {detail.batted.map((p) => {
                  const bs = state.batterStats[p.playerId]
                  const runs = bs?.runs ?? 0
                  const balls = bs?.balls ?? 0
                  const status = formatBattingScorecardStatus(match, bs, innSnap, p.playerId)
                  return (
                    <tr key={p.playerId}>
                      <td>
                        <span className="public-live-batter-name">
                          {p.name}
                          <PlayerRoleMarkers
                            match={match}
                            side={battingSideForTab}
                            playerId={p.playerId}
                          />
                          {showBatterNotOutStar(
                            state.matchComplete,
                            inningsPick,
                            state.activeInnings as 1 | 2,
                            innSnap,
                            bs,
                            p.playerId,
                          )
                            ? '*'
                            : ''}
                        </span>
                        <span
                          className="muted small public-live-batter-sub"
                          style={{ whiteSpace: 'pre-line' }}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="num">{runs}</td>
                      <td className="num">{balls}</td>
                      <td className="num">{bs?.fours ?? 0}</td>
                      <td className="num">{bs?.sixes ?? 0}</td>
                      <td className="num">{sr(runs, balls)}</td>
                    </tr>
                  )
                })}
                <tr className="public-live-subtotal">
                  <td>Extras</td>
                  <td className="num public-live-extras-cell" colSpan={5}>
                    {detail.extrasDisplay}
                  </td>
                </tr>
                <tr className="public-live-total">
                  <td>Total</td>
                  <td className="num">{innSnap.runs}/{innSnap.wickets}</td>
                  <td colSpan={4} className="public-live-total-mid muted small">
                    {oversString(innSnap.legalBalls, cfg.ballsPerOver)} ov (RR:{' '}
                    {inningsRunRateDisplay(innSnap.runs, innSnap.legalBalls, cfg.ballsPerOver)})
                    {(inningsPick === 1 ? state.manualEndInnings1 : state.manualEndInnings2) === 'declared'
                      ? ' · dec'
                      : ''}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {scorecardFow.length > 0 && (
            <div className="public-live-fow">
              <h4 className="public-live-table-title">Fall of wickets</h4>
              <p className="public-live-fow-team muted small">
                {battingSideForTab === 'home' ? match.home.name : match.away.name}
              </p>
              <p className="public-live-fow-body">
                {scorecardFow
                  .map((f) => formatFallOfWicketEntry(match, battingSideForTab, f, cfg.ballsPerOver))
                  .join(', ')}
              </p>
            </div>
          )}

          {detail.yetTo.length > 0 && (
            <div className="public-live-yet">
              <h4 className="public-live-table-title">Yet to bat</h4>
              <p className="public-live-yet-list muted small">
                {detail.yetTo.map((p, i) => (
                  <span key={p.playerId}>
                    {i > 0 ? ' · ' : null}
                    {p.name}
                    <PlayerRoleMarkers match={match} side={battingSideForTab} playerId={p.playerId} />
                  </span>
                ))}
              </p>
            </div>
          )}

          <div className="public-live-tablewrap">
            <h4 className="public-live-table-title">
              Bowling ({detail.bowlingSide === 'home' ? match.home.name : match.away.name})
            </h4>
            <table className="public-live-table">
              <thead>
                <tr>
                  <th>Bowling</th>
                  <th className="num">O</th>
                  <th className="num">M</th>
                  <th className="num">R</th>
                  <th className="num">W</th>
                  <th className="num">Econ</th>
                </tr>
              </thead>
              <tbody>
                {detail.bowlRows.map(({ id, name, stats }) => (
                  <tr key={id}>
                    <td>
                      {name}
                      <PlayerRoleMarkers match={match} side={detail.bowlingSide} playerId={id} />
                    </td>
                    <td className="num">{bowlerOversDisplay(stats.legalBalls, cfg.ballsPerOver)}</td>
                    <td className="num">0</td>
                    <td className="num">{stats.runs}</td>
                    <td className="num">{stats.wickets}</td>
                    <td className="num">{economy(stats.runs, stats.legalBalls, cfg.ballsPerOver)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
