import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { getDb, getFirebaseAuth } from '../firebase/config'
import { reauthenticateWithGoogle } from './googleSignIn'

function usesPasswordProvider(user: User): boolean {
  return user.providerData.some((p) => p.providerId === 'password')
}

function usesGoogleProvider(user: User): boolean {
  return user.providerData.some((p) => p.providerId === 'google.com')
}

async function reauthenticateForDeletion(user: User, password?: string): Promise<void> {
  const auth = getFirebaseAuth()

  if (usesPasswordProvider(user)) {
    if (!password?.trim()) {
      throw new Error('Enter your password to confirm account deletion.')
    }
    if (!user.email) {
      throw new Error('Email is missing — sign in again, then retry.')
    }
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, password.trim()),
    )
    return
  }

  if (usesGoogleProvider(user)) {
    await reauthenticateWithGoogle(auth)
    return
  }

  throw new Error('This sign-in method does not support in-app account deletion. Contact support.')
}

async function purgeUserFirestore(db: Firestore, uid: string): Promise<void> {
  const batchLimit = 400
  let batch = writeBatch(db)
  let ops = 0

  const commitIfNeeded = async (force = false) => {
    if (ops === 0) return
    if (force || ops >= batchLimit) {
      await batch.commit()
      batch = writeBatch(db)
      ops = 0
    }
  }

  const queueDelete = async (ref: ReturnType<typeof doc>) => {
    batch.delete(ref)
    ops += 1
    await commitIfNeeded()
  }

  const notifSnap = await getDocs(collection(db, 'users', uid, 'notifications'))
  for (const snap of notifSnap.docs) {
    await queueDelete(snap.ref)
  }

  const squadSnap = await getDocs(collection(db, 'users', uid, 'accessibleSquads'))
  for (const snap of squadSnap.docs) {
    await queueDelete(snap.ref)
  }

  await commitIfNeeded(true)

  try {
    await setDoc(
      doc(db, 'playerCareerStats', uid),
      {
        playerId: uid,
        profileFullName: '',
        profileDisplayName: 'Deleted user',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch {
    // Career stats may not exist or rules may block — continue with auth deletion.
  }

  await deleteDoc(doc(db, 'directoryUsers', uid)).catch(() => {})
  await deleteDoc(doc(db, 'users', uid)).catch(() => {})
}

export async function deleteAccount(password?: string): Promise<void> {
  const auth = getFirebaseAuth()
  let user = auth.currentUser
  if (!user) throw new Error('Not signed in')

  await reauthenticateForDeletion(user, password)

  user = auth.currentUser
  if (!user) throw new Error('Not signed in')

  await purgeUserFirestore(getDb(), user.uid)
  await deleteUser(user)
}
