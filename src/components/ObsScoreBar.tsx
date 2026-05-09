import {
  bowlingStatsPerInnings,
  currentInnings,
  type ReplayConfig,
  type ReplayState,
  type ScoreEvent,
  symbolsThisOver,
  oversString,
} from '../scoring/engine'
import {
  lastBallScoreBarCue,
  lastEffectiveBallSeq,
  type ScoreBarBallCue,
} from '../lib/overlayScoreBarCue'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MatchDoc, Side } from '../types/models'

function playerName(match: MatchDoc, playerId: string): string {
  return (
    match.home.players.find((p) => p.playerId === playerId)?.name ??
    match.away.players.find((p) => p.playerId === playerId)?.name ??
    playerId
  )
}

/** Short TV-style label (e.g. IND, SA, ISSK). */
function abbrevTeam(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const fromWords = parts
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 4)
    if (fromWords.length >= 2) return fromWords
  }
  return t.slice(0, 3).toUpperCase()
}

/** Prefer squad short name on the match snapshot; otherwise derive from full name. */
function teamAbbrevFromSnapshot(team: MatchDoc['home']): string {
  const s = team.shortName?.trim()
  if (s) return s.toUpperCase()
  return abbrevTeam(team.name)
}

function isWicketBallSymbol(sym: string): boolean {
  if (sym === 'W') return true
  return /^Wd\d*W$|^Nb\d*W$/.test(sym)
}

function ballCircleContent(sym: string): { wicket: boolean; label: string } {
  if (isWicketBallSymbol(sym)) return { wicket: true, label: 'W' }
  return { wicket: false, label: sym.length <= 3 ? sym : sym.slice(0, 3) }
}

type BallBarKind = 'wicket' | 'six' | 'four' | 'run'

/** Colour buckets for this-over pills (legal 4 / 6 from symbol; wicket from delivery). */
function ballBarKind(sym: string): BallBarKind {
  if (isWicketBallSymbol(sym)) return 'wicket'
  if (sym === '6') return 'six'
  if (sym === '4') return 'four'
  return 'run'
}

const BOWLER_FLASH_MS = 3000

function bowlerFlashLabel(cue: ScoreBarBallCue): string {
  if (cue === 'four') return 'FOUR'
  if (cue === 'six') return 'SIX!'
  return 'WICKET!'
}

function currentRunRate(innRuns: number, legalBalls: number, ballsPerOver: number): string {
  if (legalBalls <= 0) return innRuns > 0 ? innRuns.toFixed(2) : '0.00'
  const overs = legalBalls / ballsPerOver
  return (innRuns / overs).toFixed(2)
}

type Props = {
  match: MatchDoc & { id: string }
  cfg: ReplayConfig
  state: ReplayState
  events: ScoreEvent[]
}

export function ObsScoreBar({ match, cfg, state, events }: Props) {
  const inn = currentInnings(state)
  const batting = inn.battingSide
  const fielding: Side = batting === 'home' ? 'away' : 'home'

  const batSnap = batting === 'home' ? match.home : match.away
  const bowlSnap = fielding === 'home' ? match.home : match.away
  const batAbbr = teamAbbrevFromSnapshot(batSnap)
  const bowlAbbr = teamAbbrevFromSnapshot(bowlSnap)

  const strikerId = inn.strikerId
  const nonId = inn.nonStrikerId

  const sRuns = state.batterStats[strikerId]?.runs ?? 0
  const sBalls = state.batterStats[strikerId]?.balls ?? 0
  const nRuns = state.batterStats[nonId]?.runs ?? 0
  const nBalls = state.batterStats[nonId]?.balls ?? 0

  const strikerName = playerName(match, strikerId).toUpperCase()
  const nonName = playerName(match, nonId).toUpperCase()

  const bowlerId = inn.bowlerId
  const bowlerName = playerName(match, bowlerId).toUpperCase()

  const perInn = bowlingStatsPerInnings(cfg, events)
  const bowlBucket = inn.innings === 1 ? perInn.innings1 : perInn.innings2
  const bFig = bowlBucket[bowlerId] ?? { legalBalls: 0, runs: 0, wickets: 0 }
  const bowlerOvers = oversString(bFig.legalBalls, cfg.ballsPerOver)

  const syms = symbolsThisOver(cfg, events)
  const symsKey = syms.join('|')

  const ballsScrollRef = useRef<HTMLDivElement>(null)
  const [scrollFade, setScrollFade] = useState({ left: false, right: false })
  const [bowlerFlash, setBowlerFlash] = useState<ScoreBarBallCue | null>(null)
  const skipInitialCueRef = useRef(true)
  const prevBallSeqRef = useRef<number | null>(null)
  const bowlerFlashHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Only advances when a new ball event seq appears — avoids effect churn clearing the hide timer on redundant Firestore snapshots. */
  const ballSeqEffective = lastEffectiveBallSeq(events)

  useEffect(() => {
    if (ballSeqEffective == null) return

    if (skipInitialCueRef.current) {
      skipInitialCueRef.current = false
      prevBallSeqRef.current = ballSeqEffective
      return
    }

    const prev = prevBallSeqRef.current
    if (prev != null && ballSeqEffective <= prev) {
      prevBallSeqRef.current = ballSeqEffective
      return
    }
    prevBallSeqRef.current = ballSeqEffective

    const cue = lastBallScoreBarCue(cfg, events)
    if (!cue) return

    if (bowlerFlashHideTimerRef.current) {
      window.clearTimeout(bowlerFlashHideTimerRef.current)
      bowlerFlashHideTimerRef.current = null
    }

    const rafShow = window.requestAnimationFrame(() => {
      setBowlerFlash(cue)
      bowlerFlashHideTimerRef.current = window.setTimeout(() => {
        setBowlerFlash(null)
        bowlerFlashHideTimerRef.current = null
      }, BOWLER_FLASH_MS)
    })

    return () => {
      window.cancelAnimationFrame(rafShow)
      if (bowlerFlashHideTimerRef.current) {
        window.clearTimeout(bowlerFlashHideTimerRef.current)
        bowlerFlashHideTimerRef.current = null
      }
      setBowlerFlash(null)
    }
    // `events` read inside only when seq advances (same render has matching events for cue).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed off ball seq, not events reference churn
  }, [cfg, ballSeqEffective])

  const updateScrollFade = useCallback(() => {
    const el = ballsScrollRef.current
    if (!el) {
      setScrollFade({ left: false, right: false })
      return
    }
    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScroll = scrollWidth - clientWidth
    const slack = 4
    setScrollFade({
      left: scrollLeft > slack,
      right: maxScroll > slack && scrollLeft < maxScroll - slack,
    })
  }, [])

  useLayoutEffect(() => {
    void symsKey
    updateScrollFade()
    const el = ballsScrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => updateScrollFade())
    ro.observe(el)
    el.addEventListener('scroll', updateScrollFade, { passive: true })
    window.addEventListener('resize', updateScrollFade)
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', updateScrollFade)
      window.removeEventListener('resize', updateScrollFade)
    }
  }, [updateScrollFade, symsKey])

  const rr = currentRunRate(inn.runs, inn.legalBalls, cfg.ballsPerOver)
  const oversDisp = `${oversString(inn.legalBalls, cfg.ballsPerOver)}/${cfg.oversLimit}`

  return (
    <div className="obs-score-bar" role="status" aria-live="polite">
      <div className="obs-score-bar__segment obs-score-bar__abbr">{batAbbr}</div>

      <div className="obs-score-bar__segment obs-score-bar__batters">
        <div className="obs-batter-row">
          <span className="obs-batter-play">
            <span className="obs-batter-tri" aria-hidden>
              ▶
            </span>
            <span className="obs-batter-name">{strikerName}</span>
          </span>
          <span className="obs-batter-nums">
            <strong>{sRuns}</strong> <span className="obs-batter-balls">{sBalls}</span>
          </span>
        </div>
        <div className="obs-batter-row obs-batter-row--non">
          <span className="obs-batter-play">
            <span className="obs-batter-tri obs-batter-tri--spacer" aria-hidden>
              ▶
            </span>
            <span className="obs-batter-name">{nonName}</span>
          </span>
          <span className="obs-batter-nums">
            <strong>{nRuns}</strong> <span className="obs-batter-balls">{nBalls}</span>
          </span>
        </div>
      </div>

      <div className="obs-score-bar__center">
        <div className="obs-score-bar__center-split">
          <div className="obs-score-bar__pink">
            <span className="obs-score-bar__pink-abbr">{batAbbr}</span>{' '}
            <span className="obs-score-bar__pink-score">
              {inn.runs}/{inn.wickets}
            </span>
          </div>
          <div className="obs-score-bar__cyan">{oversDisp}</div>
        </div>
        <div className="obs-score-bar__navy">
          RUN RATE {rr}
        </div>
      </div>

      <div className="obs-score-bar__segment obs-score-bar__bowler">
        <div className="obs-bowler-stack">
          <div className="obs-bowler-top">
            <span className="obs-bowler-name">{bowlerName}</span>
            <span className="obs-bowler-figs">
              <span className="obs-bowler-wr">
                {bFig.wickets}-{bFig.runs}
              </span>
              <span className="obs-bowler-ov">{bowlerOvers}</span>
            </span>
          </div>
          <div className="obs-bowler-balls-wrap">
            <div
              ref={ballsScrollRef}
              className="obs-bowler-balls"
              role="group"
              aria-label="This over — scroll sideways for more deliveries"
              tabIndex={scrollFade.left || scrollFade.right ? 0 : undefined}
            >
              {syms.map((sym, i) => {
                const { label } = ballCircleContent(sym)
                const kind = ballBarKind(sym)
                return (
                  <div key={`${i}-${sym}`} className={`obs-ball obs-ball--${kind}`}>
                    {label}
                  </div>
                )
              })}
            </div>
            <div
              className={`obs-bowler-balls-fade obs-bowler-balls-fade--left${scrollFade.left ? ' obs-bowler-balls-fade--on' : ''}`}
              aria-hidden
            >
              <span className="obs-bowler-balls-fade-icon">‹</span>
            </div>
            <div
              className={`obs-bowler-balls-fade obs-bowler-balls-fade--right${scrollFade.right ? ' obs-bowler-balls-fade--on' : ''}`}
              aria-hidden
            >
              <span className="obs-bowler-balls-fade-icon">›</span>
            </div>
          </div>
          {bowlerFlash ? (
            <div
              className={`obs-bowler-flash obs-bowler-flash--${bowlerFlash}`}
              aria-hidden
            >
              <span className="obs-bowler-flash__text">{bowlerFlashLabel(bowlerFlash)}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="obs-score-bar__segment obs-score-bar__abbr">{bowlAbbr}</div>
    </div>
  )
}
