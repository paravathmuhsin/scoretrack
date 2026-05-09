import {
  type Firestore,
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore'
import type { MatchDoc } from '../types/models'

export type MatchRow = { id: string } & MatchDoc

/**
 * Real-time match by `publicId` for `/live/:publicId` and overlay.
 *
 * Firestore rejects a query that could return a document the client cannot read.
 * So we never use `where('publicId' == x)` alone for signed-in users (it could hit
 * someone else's private doc). Instead:
 * - **Public path:** `publicId` + `isPublic == true` (works for everyone).
 * - **Owner path (signed in only):** `publicId` + `createdBy == uid` (private or public own match).
 *
 * Merge: prefer owner snapshot when it has a row (covers private), else public row.
 */
export function subscribeMatchByPublicId(
  db: Firestore,
  publicId: string,
  opts: { userId: string | undefined },
  callbacks: {
    onMatch: (m: MatchRow | null) => void
    onError: (err: Error) => void
  },
): () => void {
  const col = collection(db, 'matches')
  const qPublic = query(col, where('publicId', '==', publicId), where('isPublic', '==', true), limit(1))

  let publicRow: MatchRow | null = null
  let ownerRow: MatchRow | null = null
  let publicHeard = false
  let ownerHeard = false

  /**
   * Signed-in: publish as soon as we have a row (owner wins), or null once *both* listeners
   * have reported empty (avoids "not found" flash before the owner snapshot arrives).
   */
  const merge = () => {
    if (!opts.userId) {
      callbacks.onMatch(publicRow)
      return
    }
    if (ownerRow) {
      callbacks.onMatch(ownerRow)
      return
    }
    if (publicRow) {
      callbacks.onMatch(publicRow)
      return
    }
    if (publicHeard && ownerHeard) {
      callbacks.onMatch(null)
    }
  }

  const unsubPublic = onSnapshot(
    qPublic,
    (snap) => {
      publicHeard = true
      publicRow = snap.empty ? null : { id: snap.docs[0]!.id, ...(snap.docs[0]!.data() as MatchDoc) }
      merge()
    },
    (err) => callbacks.onError(err as Error),
  )

  const unsubs: (() => void)[] = [unsubPublic]

  if (opts.userId) {
    const qOwner = query(col, where('publicId', '==', publicId), where('createdBy', '==', opts.userId), limit(1))
    const unsubOwner = onSnapshot(
      qOwner,
      (snap) => {
        ownerHeard = true
        ownerRow = snap.empty ? null : { id: snap.docs[0]!.id, ...(snap.docs[0]!.data() as MatchDoc) }
        merge()
      },
      (err) => callbacks.onError(err as Error),
    )
    unsubs.push(unsubOwner)
  }

  return () => {
    unsubs.forEach((u) => u())
  }
}
