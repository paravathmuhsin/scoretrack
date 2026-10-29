import type { MatchDoc, MatchLineup, Side } from '@/types/models'
import { ts } from './timestamp'

const roster = (side: Side) =>
  [
    { playerId: `${side}-1`, name: side === 'home' ? 'Alex Kohli' : 'Sam Sharma' },
    { playerId: `${side}-2`, name: side === 'home' ? 'Jordan Patel' : 'Riley Singh' },
    { playerId: `${side}-3`, name: side === 'home' ? 'Casey Khan' : 'Morgan Lee' },
    { playerId: `${side}-4`, name: side === 'home' ? 'Taylor Roy' : 'Jamie Das' },
    { playerId: `${side}-5`, name: side === 'home' ? 'Quinn Nair' : 'Avery Menon' },
    { playerId: `${side}-6`, name: side === 'home' ? 'Skyler Iyer' : 'Blake Reddy' },
    { playerId: `${side}-7`, name: side === 'home' ? 'Drew Verma' : 'Cameron Joshi' },
    { playerId: `${side}-8`, name: side === 'home' ? 'Emery Gupta' : 'Finley Rao' },
    { playerId: `${side}-9`, name: side === 'home' ? 'Harper Mehta' : 'Indigo Shah' },
    { playerId: `${side}-10`, name: side === 'home' ? 'Jules Banerjee' : 'Kai Malhotra' },
    { playerId: `${side}-11`, name: side === 'home' ? 'Lane Chatterjee' : 'Noah Pillai' },
  ] as const

export function makeLineup(batting: Side = 'home'): MatchLineup {
  const xi = (side: Side) => roster(side).slice(0, 11).map((p) => p.playerId)
  return {
    innings1BattingSide: batting,
    homeXI: xi('home'),
    awayXI: xi('away'),
    strikerId: `${batting}-1`,
    nonStrikerId: `${batting}-2`,
    bowlerId: batting === 'home' ? 'away-3' : 'home-3',
    homeCaptainId: 'home-1',
    homeKeeperId: 'home-2',
    awayCaptainId: 'away-1',
    awayKeeperId: 'away-2',
  }
}

export function makeMatchDoc(overrides: Partial<MatchDoc> = {}): MatchDoc {
  return {
    tournamentId: null,
    home: {
      name: 'North Stars',
      shortName: 'NST',
      players: [...roster('home')],
    },
    away: {
      name: 'Coastal Kings',
      shortName: 'CKG',
      players: [...roster('away')],
    },
    squadSize: 11,
    oversLimit: 20,
    ballsPerOver: 6,
    scheduledAt: ts('2026-04-12T14:00:00Z'),
    status: 'live',
    createdBy: 'demo-user',
    isPublic: true,
    publicId: 'demo-public-id',
    lineup: makeLineup('home'),
    ...overrides,
  }
}

export function makeMatchWithId(overrides: Partial<MatchDoc> = {}) {
  return { id: 'match-demo', ...makeMatchDoc(overrides) }
}
