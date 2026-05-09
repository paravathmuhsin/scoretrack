import { collection, endAt, getDocs, limit, orderBy, query, startAt } from 'firebase/firestore'
import type { DirectoryUserDoc } from '../types/models'
import { getDb } from '../firebase/config'
import { normalizePhoneDigits } from './phoneDigits'

export type DirectoryHit = { uid: string } & DirectoryUserDoc

/** Minimum letters for name/email prefix search, or minimum digits for phone prefix search. */
export function canSearchDirectory(raw: string): boolean {
  const t = raw.trim()
  if (t.length >= 2) return true
  return normalizePhoneDigits(raw).length >= 4
}

function uniqByUid(arrays: DirectoryHit[][], maxResults: number): DirectoryHit[] {
  const seen = new Set<string>()
  const out: DirectoryHit[] = []
  for (const arr of arrays) {
    for (const h of arr) {
      if (seen.has(h.uid)) continue
      seen.add(h.uid)
      out.push(h)
      if (out.length >= maxResults) return out
    }
  }
  return out
}

async function queryNamePrefix(db: ReturnType<typeof getDb>, term: string, lim: number): Promise<DirectoryHit[]> {
  const qy = query(
    collection(db, 'directoryUsers'),
    orderBy('displayNameLower'),
    startAt(term),
    endAt(`${term}\uf8ff`),
    limit(lim),
  )
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as DirectoryUserDoc) }))
}

async function queryEmailPrefix(db: ReturnType<typeof getDb>, term: string, lim: number): Promise<DirectoryHit[]> {
  const qy = query(
    collection(db, 'directoryUsers'),
    orderBy('emailLower'),
    startAt(term),
    endAt(`${term}\uf8ff`),
    limit(lim),
  )
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as DirectoryUserDoc) }))
}

async function queryPhonePrefix(db: ReturnType<typeof getDb>, digits: string, lim: number): Promise<DirectoryHit[]> {
  const qy = query(
    collection(db, 'directoryUsers'),
    orderBy('phoneDigits'),
    startAt(digits),
    endAt(`${digits}\uf8ff`),
    limit(lim),
  )
  const snap = await getDocs(qy)
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as DirectoryUserDoc) }))
}

/**
 * Prefix search on display name, email, or phone digits (Firestore range queries).
 */
export async function searchDirectoryUsers(raw: string, maxResults = 25): Promise<DirectoryHit[]> {
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()
  const digitTerm = normalizePhoneDigits(raw)

  const textOk = lower.length >= 2
  const phoneOk = digitTerm.length >= 4

  if (!textOk && !phoneOk) return []

  const db = getDb()
  const perQuery = Math.max(maxResults, 15)

  const tasks: Promise<DirectoryHit[]>[] = []
  if (textOk) {
    tasks.push(queryNamePrefix(db, lower, perQuery))
    tasks.push(queryEmailPrefix(db, lower, perQuery))
  }
  if (phoneOk) {
    tasks.push(queryPhonePrefix(db, digitTerm, perQuery))
  }

  const parts = await Promise.all(tasks)
  return uniqByUid(parts, maxResults)
}
