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
 * Real-time match by `publicId` for `/live/:publicId` and `/overlay/:publicId`.
 *
 * Anyone with the link can read the match (see Firestore rules: `matchHasLivePublicId`).
 */
export function subscribeMatchByPublicId(
  db: Firestore,
  publicId: string,
  callbacks: {
    onMatch: (m: MatchRow | null) => void
    onError: (err: Error) => void
  },
): () => void {
  const qy = query(collection(db, 'matches'), where('publicId', '==', publicId), limit(1))
  return onSnapshot(
    qy,
    (snap) => {
      callbacks.onMatch(
        snap.empty ? null : { id: snap.docs[0]!.id, ...(snap.docs[0]!.data() as MatchDoc) },
      )
    },
    (err) => callbacks.onError(err as Error),
  )
}
