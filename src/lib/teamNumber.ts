import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore'
import type { TeamDoc } from '../types/models'

export const TEAM_NUMBER_MIN = 100_000
export const TEAM_NUMBER_MAX = 999_999

export function squadKey(ownerUid: string, teamId: string): string {
  return `${ownerUid}:${teamId}`
}

export function parseSquadKey(key: string): { ownerUid: string; teamId: string } | null {
  const i = key.indexOf(':')
  if (i <= 0 || i >= key.length - 1) return null
  return { ownerUid: key.slice(0, i), teamId: key.slice(i + 1) }
}

export function formatTeamNumber(n: number): string {
  return String(n).padStart(6, '0')
}

export function parseTeamNumberInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 0) return null
  const n = Number(digits)
  if (!Number.isInteger(n) || n < TEAM_NUMBER_MIN || n > TEAM_NUMBER_MAX) return null
  return n
}

function randomTeamNumber(): number {
  return TEAM_NUMBER_MIN + Math.floor(Math.random() * (TEAM_NUMBER_MAX - TEAM_NUMBER_MIN + 1))
}

function isPermissionDenied(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'permission-denied'
  )
}

function teamNumberRulesHint(): string {
  return 'Firestore rules for team IDs may be missing. Deploy firestore.rules (firebase deploy --only firestore:rules) and try again.'
}

export function isAccessibleSquad(
  uid: string,
  ownerUid: string,
  team: Pick<TeamDoc, 'ownerIds'>,
): boolean {
  if (uid === ownerUid) return true
  const owners = team.ownerIds ?? []
  return owners.includes(uid)
}

export type TeamNumberRegistryDoc = {
  ownerUid: string
  teamId: string
}

export type ResolvedTeamByNumber = {
  ownerUid: string
  teamId: string
  team: TeamDoc & { id: string }
}

type ClaimSlotResult = 'claimed' | 'taken' | 'blocked'

/** Reserve a registry slot (create-only). */
async function tryClaimRegistrySlot(
  db: Firestore,
  candidate: number,
  ownerUid: string,
  teamId: string,
): Promise<ClaimSlotResult> {
  const registryRef = doc(db, 'teamNumbers', String(candidate))
  try {
    await setDoc(registryRef, { ownerUid, teamId } satisfies TeamNumberRegistryDoc)
    return 'claimed'
  } catch (err) {
    if (!isPermissionDenied(err)) throw err
    try {
      const snap = await getDoc(registryRef)
      return snap.exists() ? 'taken' : 'taken'
    } catch (readErr) {
      if (isPermissionDenied(readErr)) return 'blocked'
      throw readErr
    }
  }
}

/** Allocate a unique 6-digit team number and write registry + squad doc. */
export async function allocateTeamNumber(
  db: Firestore,
  ownerUid: string,
  teamId: string,
): Promise<number> {
  const teamRef = doc(db, 'users', ownerUid, 'teams', teamId)
  const existing = await getDoc(teamRef)
  if (!existing.exists()) throw new Error('Team not found.')
  const data = existing.data() as TeamDoc
  if (data.teamNumber != null) return data.teamNumber

  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = randomTeamNumber()
    const claim = await tryClaimRegistrySlot(db, candidate, ownerUid, teamId)
    if (claim === 'blocked') {
      throw new Error(teamNumberRulesHint())
    }
    if (claim !== 'claimed') {
      continue
    }

    try {
      await updateDoc(teamRef, { teamNumber: candidate })
      return candidate
    } catch (err) {
      if (isPermissionDenied(err)) {
        throw new Error(teamNumberRulesHint())
      }
      throw err instanceof Error ? err : new Error('Could not save team ID on squad.')
    }
  }

  throw new Error('Could not assign a team ID. Try again.')
}

/** Backfill when missing; no-op if already set. */
export async function ensureTeamNumber(
  db: Firestore,
  ownerUid: string,
  teamId: string,
): Promise<number | null> {
  const teamRef = doc(db, 'users', ownerUid, 'teams', teamId)
  const snap = await getDoc(teamRef)
  if (!snap.exists()) return null
  const data = snap.data() as TeamDoc
  if (data.teamNumber != null) return data.teamNumber
  return allocateTeamNumber(db, ownerUid, teamId)
}

async function lookupViaCollectionGroup(
  db: Firestore,
  teamNumber: number,
): Promise<ResolvedTeamByNumber | null> {
  try {
    const qy = query(collectionGroup(db, 'teams'), where('teamNumber', '==', teamNumber))
    const snap = await getDocs(qy)
    if (snap.empty) return null
    const teamSnap = snap.docs[0]!
    const ownerUid = teamSnap.ref.parent.parent?.id
    if (!ownerUid) return null
    return {
      ownerUid,
      teamId: teamSnap.id,
      team: { id: teamSnap.id, ...(teamSnap.data() as TeamDoc) },
    }
  } catch (err) {
    if (isPermissionDenied(err)) return null
    throw err
  }
}

async function resolveTeamFromRegistry(
  db: Firestore,
  ownerUid: string,
  teamId: string,
): Promise<ResolvedTeamByNumber | null> {
  try {
    const teamSnap = await getDoc(doc(db, 'users', ownerUid, 'teams', teamId))
    if (!teamSnap.exists()) return null
    return {
      ownerUid,
      teamId,
      team: { id: teamSnap.id, ...(teamSnap.data() as TeamDoc) },
    }
  } catch (err) {
    if (isPermissionDenied(err)) return null
    throw err
  }
}

export async function lookupTeamByNumber(
  db: Firestore,
  teamNumber: number,
): Promise<ResolvedTeamByNumber | null> {
  const registryRef = doc(db, 'teamNumbers', String(teamNumber))
  try {
    const regSnap = await getDoc(registryRef)
    if (regSnap.exists()) {
      const { ownerUid, teamId } = regSnap.data() as TeamNumberRegistryDoc
      return resolveTeamFromRegistry(db, ownerUid, teamId)
    }
    return lookupViaCollectionGroup(db, teamNumber)
  } catch (err) {
    if (!isPermissionDenied(err)) throw err
    // Registry read blocked (e.g. rules not deployed) — fall back to collection group.
    return lookupViaCollectionGroup(db, teamNumber)
  }
}

/** Primary owner + co-owners who can act for the squad. */
export function teamParticipantRecipientUids(
  ownerUid: string,
  team: Pick<TeamDoc, 'ownerIds'>,
): string[] {
  const out = new Set<string>([ownerUid])
  for (const id of team.ownerIds ?? []) {
    if (id) out.add(id)
  }
  return [...out]
}
