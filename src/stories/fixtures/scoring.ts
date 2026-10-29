import {
  initialReplayState,
  type ReplayConfig,
  type ReplayState,
  type ScoreEvent,
} from '@/scoring/engine'
import { makeLineup, makeMatchDoc } from './match'

export function makeReplayConfig(): ReplayConfig {
  const match = makeMatchDoc({ status: 'live', lineup: makeLineup('home') })
  return {
    squadSize: match.squadSize,
    oversLimit: match.oversLimit,
    ballsPerOver: match.ballsPerOver,
    oversPerBowler: match.oversPerBowler ?? null,
    lineup: match.lineup!,
    homeName: match.home.name,
    awayName: match.away.name,
  }
}

export function makeReplayState(partial?: Partial<ReplayState>): ReplayState {
  const cfg = makeReplayConfig()
  const state = initialReplayState(cfg)
  state.innings1.runs = 87
  state.innings1.wickets = 2
  state.innings1.legalBalls = 72
  return { ...state, ...partial }
}

export function makeScoreEvents(): ScoreEvent[] {
  return []
}

export function makeObsProps() {
  const match = { id: 'match-demo', ...makeMatchDoc({ status: 'live' }) }
  const cfg = makeReplayConfig()
  const state = makeReplayState()
  const events = makeScoreEvents()
  return { match, cfg, state, events }
}
