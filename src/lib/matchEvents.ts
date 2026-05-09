import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import type { BallEventPayload } from '../types/models'
import type { ScoreEvent } from '../scoring/engine'
import { getDb } from '../firebase/config'

/** Firestore forbids `undefined`; strip optional nested fields. */
export function ballPayloadForFirestore(ball: BallEventPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {
    innings: ball.innings,
    battingSide: ball.battingSide,
    delivery: ball.delivery,
    runsOffBat: ball.runsOffBat,
    extraWideRuns: ball.extraWideRuns,
    extraNoBallRuns: ball.extraNoBallRuns,
    byeRuns: ball.byeRuns,
    legByeRuns: ball.legByeRuns,
  }
  if (ball.noDelivery === true) {
    out.noDelivery = true
  }
  if (ball.wicket) {
    const w = ball.wicket
    const wicket: Record<string, unknown> = {
      dismissedId: w.dismissedId,
      howOut: w.howOut,
    }
    if (w.countsAsWicket === false) {
      wicket.countsAsWicket = false
    }
    if (w.newBatsmanId !== undefined && w.newBatsmanId !== '') {
      wicket.newBatsmanId = w.newBatsmanId
    }
    if (w.fielderId !== undefined && w.fielderId !== '') {
      wicket.fielderId = w.fielderId
    }
    if (w.fielderName !== undefined && w.fielderName !== '') {
      wicket.fielderName = w.fielderName
    }
    out.wicket = wicket
  }
  return out
}

/** Parse a single Firestore `matches/{id}/events/*` document into a replay event (or null if unknown). */
export function scoreEventFromFirestore(x: {
  seq: number
  kind: string
  ball?: BallEventPayload
  revertedSeq?: number
  battingSide?: string
  strikerId?: string
  nonStrikerId?: string
  bowlerId?: string
  runs?: number
  innings?: number
  reason?: string
}): ScoreEvent | null {
  if (x.kind === 'ball' && x.ball) return { seq: x.seq, kind: 'ball', ball: x.ball }
  if (x.kind === 'undo') return { seq: x.seq, kind: 'undo', revertedSeq: x.revertedSeq ?? 0 }
  if (x.kind === 'start_second_innings' && x.battingSide && x.strikerId && x.nonStrikerId && x.bowlerId) {
    return {
      seq: x.seq,
      kind: 'start_second_innings',
      battingSide: x.battingSide as 'home' | 'away',
      strikerId: x.strikerId,
      nonStrikerId: x.nonStrikerId,
      bowlerId: x.bowlerId,
    }
  }
  if (x.kind === 'change_bowler' && x.bowlerId) return { seq: x.seq, kind: 'change_bowler', bowlerId: x.bowlerId }
  if (x.kind === 'swap_ends') return { seq: x.seq, kind: 'swap_ends' }
  if (x.kind === 'overthrow' && typeof x.runs === 'number') return { seq: x.seq, kind: 'overthrow', runs: x.runs }
  if (
    x.kind === 'end_innings' &&
    (x.innings === 1 || x.innings === 2) &&
    (x.reason === 'declared' || x.reason === 'all_out')
  ) {
    return {
      seq: x.seq,
      kind: 'end_innings',
      innings: x.innings as 1 | 2,
      reason: x.reason,
    }
  }
  return null
}

export async function fetchMatchEvents(matchId: string): Promise<ScoreEvent[]> {
  const qy = query(collection(getDb(), 'matches', matchId, 'events'), orderBy('seq', 'asc'))
  const snap = await getDocs(qy)
  const out: ScoreEvent[] = []
  snap.forEach((d) => {
    const ev = scoreEventFromFirestore(d.data() as Parameters<typeof scoreEventFromFirestore>[0])
    if (ev) out.push(ev)
  })
  return out
}

export async function appendBallEvent(matchId: string, ball: BallEventPayload): Promise<void> {
  const db = getDb()
  const matchRef = doc(db, 'matches', matchId)
  const eventsCol = collection(db, 'matches', matchId, 'events')
  await runTransaction(db, async (tx) => {
    const m = await tx.get(matchRef)
    const last = (m.data()?.lastEventSeq as number | undefined) ?? 0
    const seq = last + 1
    const evRef = doc(eventsCol)
    tx.set(evRef, {
      seq,
      kind: 'ball',
      ball: ballPayloadForFirestore(ball),
      createdAt: serverTimestamp(),
    })
    tx.update(matchRef, { lastEventSeq: seq })
  })
}

export async function appendUndo(matchId: string, revertedSeq: number): Promise<void> {
  const db = getDb()
  const matchRef = doc(db, 'matches', matchId)
  const eventsCol = collection(db, 'matches', matchId, 'events')
  await runTransaction(db, async (tx) => {
    const m = await tx.get(matchRef)
    const last = (m.data()?.lastEventSeq as number | undefined) ?? 0
    const seq = last + 1
    const evRef = doc(eventsCol)
    tx.set(evRef, {
      seq,
      kind: 'undo',
      revertedSeq,
      createdAt: serverTimestamp(),
    })
    tx.update(matchRef, { lastEventSeq: seq })
  })
}

export async function appendSwapEnds(matchId: string): Promise<void> {
  const db = getDb()
  const matchRef = doc(db, 'matches', matchId)
  const eventsCol = collection(db, 'matches', matchId, 'events')
  await runTransaction(db, async (tx) => {
    const m = await tx.get(matchRef)
    const last = (m.data()?.lastEventSeq as number | undefined) ?? 0
    const seq = last + 1
    const evRef = doc(eventsCol)
    tx.set(evRef, {
      seq,
      kind: 'swap_ends',
      createdAt: serverTimestamp(),
    })
    tx.update(matchRef, { lastEventSeq: seq })
  })
}

export async function appendOverthrow(matchId: string, runs: number): Promise<void> {
  const db = getDb()
  const matchRef = doc(db, 'matches', matchId)
  const eventsCol = collection(db, 'matches', matchId, 'events')
  await runTransaction(db, async (tx) => {
    const m = await tx.get(matchRef)
    const last = (m.data()?.lastEventSeq as number | undefined) ?? 0
    const seq = last + 1
    const evRef = doc(eventsCol)
    tx.set(evRef, {
      seq,
      kind: 'overthrow',
      runs,
      createdAt: serverTimestamp(),
    })
    tx.update(matchRef, { lastEventSeq: seq })
  })
}

export async function appendChangeBowler(matchId: string, bowlerId: string): Promise<void> {
  const db = getDb()
  const matchRef = doc(db, 'matches', matchId)
  const eventsCol = collection(db, 'matches', matchId, 'events')
  await runTransaction(db, async (tx) => {
    const m = await tx.get(matchRef)
    const last = (m.data()?.lastEventSeq as number | undefined) ?? 0
    const seq = last + 1
    const evRef = doc(eventsCol)
    tx.set(evRef, {
      seq,
      kind: 'change_bowler',
      bowlerId,
      createdAt: serverTimestamp(),
    })
    tx.update(matchRef, { lastEventSeq: seq })
  })
}

export async function appendEndInnings(
  matchId: string,
  payload: { innings: 1 | 2; reason: 'declared' | 'all_out' },
): Promise<void> {
  const db = getDb()
  const matchRef = doc(db, 'matches', matchId)
  const eventsCol = collection(db, 'matches', matchId, 'events')
  await runTransaction(db, async (tx) => {
    const m = await tx.get(matchRef)
    const last = (m.data()?.lastEventSeq as number | undefined) ?? 0
    const seq = last + 1
    const evRef = doc(eventsCol)
    tx.set(evRef, {
      seq,
      kind: 'end_innings',
      innings: payload.innings,
      reason: payload.reason,
      createdAt: serverTimestamp(),
    })
    tx.update(matchRef, { lastEventSeq: seq })
  })
}

export async function appendSecondInningsStart(
  matchId: string,
  payload: {
    battingSide: 'home' | 'away'
    strikerId: string
    nonStrikerId: string
    bowlerId: string
  },
): Promise<void> {
  const db = getDb()
  const matchRef = doc(db, 'matches', matchId)
  const eventsCol = collection(db, 'matches', matchId, 'events')
  await runTransaction(db, async (tx) => {
    const m = await tx.get(matchRef)
    const last = (m.data()?.lastEventSeq as number | undefined) ?? 0
    const seq = last + 1
    const evRef = doc(eventsCol)
    tx.set(evRef, {
      seq,
      kind: 'start_second_innings',
      ...payload,
      createdAt: serverTimestamp(),
    })
    tx.update(matchRef, { lastEventSeq: seq })
  })
}

export async function findMatchIdByPublicId(publicId: string): Promise<string | null> {
  const qy = query(collection(getDb(), 'matches'), where('publicId', '==', publicId), limit(1))
  const snap = await getDocs(qy)
  if (snap.empty) return null
  return snap.docs[0].id
}
