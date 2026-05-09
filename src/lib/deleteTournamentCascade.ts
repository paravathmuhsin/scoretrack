import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
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

/**
 * Deletes a tournament document, standings/stats summaries, and every match with this `tournamentId`
 * (including each match’s `events` and `innings` subcollections).
 * Team roster documents under `tournaments/{id}/teams` are kept; `organiserUid` is backfilled when missing
 * so rules still allow the organiser to read them after the parent tournament doc is removed.
 */
export async function deleteTournamentCascade(db: Firestore, tournamentId: string): Promise<void> {
  const tRef = doc(db, 'tournaments', tournamentId)
  const tSnap = await getDoc(tRef)
  if (!tSnap.exists()) return
  const createdBy = (tSnap.data() as { createdBy?: string }).createdBy
  if (!createdBy) throw new Error('Tournament has no owner')

  const matchesSnap = await getDocs(query(collection(db, 'matches'), where('tournamentId', '==', tournamentId)))

  for (const m of matchesSnap.docs) {
    const mid = m.id
    const eventsSnap = await getDocs(collection(db, 'matches', mid, 'events'))
    await batchDeleteRefs(
      db,
      eventsSnap.docs.map((d) => d.ref),
    )
    const inningsSnap = await getDocs(collection(db, 'matches', mid, 'innings'))
    await batchDeleteRefs(
      db,
      inningsSnap.docs.map((d) => d.ref),
    )
    await deleteDoc(doc(db, 'matches', mid))
  }

  const linkedSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'linkedTeams'))
  await batchDeleteRefs(
    db,
    linkedSnap.docs.map((d) => d.ref),
  )

  const groupsSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'groups'))
  await batchDeleteRefs(
    db,
    groupsSnap.docs.map((d) => d.ref),
  )

  const teamsSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'teams'))
  for (const d of teamsSnap.docs) {
    const data = d.data() as { organiserUid?: string }
    if (!data.organiserUid) {
      await updateDoc(d.ref, { organiserUid: createdBy })
    }
  }

  const standingsSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'standings'))
  for (const d of standingsSnap.docs) {
    await deleteDoc(d.ref).catch(() => undefined)
  }

  await deleteDoc(doc(db, 'tournaments', tournamentId, 'stats', 'summary')).catch(() => undefined)

  await deleteDoc(tRef)
}
