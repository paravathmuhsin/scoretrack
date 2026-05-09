import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'

const BATCH_SIZE = 450

async function batchDeleteRefs(db: Firestore, refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const slice = refs.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    for (const r of slice) {
      batch.delete(r)
    }
    await batch.commit()
  }
}

/** Deletes `matches/{matchId}` after removing `events` and `innings` subcollections. */
export async function deleteMatchCascade(db: Firestore, matchId: string): Promise<void> {
  const eventsSnap = await getDocs(collection(db, 'matches', matchId, 'events'))
  await batchDeleteRefs(
    db,
    eventsSnap.docs.map((d) => d.ref),
  )
  const inningsSnap = await getDocs(collection(db, 'matches', matchId, 'innings'))
  await batchDeleteRefs(
    db,
    inningsSnap.docs.map((d) => d.ref),
  )
  await deleteDoc(doc(db, 'matches', matchId))
}
