import { doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'

/** Mirrors profile names onto `playerCareerStats/{uid}` so `/player/:uid` can show them without reading `users/*`. */
export async function syncPlayerCareerProfileNames(
  db: Firestore,
  uid: string,
  fullName: string,
  displayName: string,
): Promise<void> {
  await setDoc(
    doc(db, 'playerCareerStats', uid),
    {
      playerId: uid,
      profileFullName: fullName.trim(),
      profileDisplayName: displayName.trim(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
