import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { directoryFieldsForUser } from './userDirectory'
import { getDb, getFirebaseAuth } from '../firebase/config'
import { MOBILE_TEN_DIGIT_MSG, normalizeOptionalTenDigitMobile } from '../lib/phoneDigits'
import type { UserProfileDoc } from '../types/models'
import { AuthContext, type AuthContextValue } from './context'

const googleProvider = new GoogleAuthProvider()

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextValue['user']>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const auth = getFirebaseAuth()
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (!u) {
        setLoading(false)
        return
      }
      /**
       * Keep `loading` true until Firestore profile sync finishes so /app does not mount
       * snapshot listeners while the SDK may still be treating the session as unauthenticated
       * (avoids permission-denied on users/{uid} and other reads right after sign-in).
       */
      setLoading(true)
      try {
        await u.getIdToken()
        const ref = doc(getDb(), 'users', u.uid)
        const snap = await getDoc(ref)
        let profile: UserProfileDoc | undefined

        if (!snap.exists()) {
          const displayName = u.displayName ?? u.email ?? 'Player'
          await setDoc(ref, {
            displayName,
            createdAt: serverTimestamp(),
          })
          profile = { displayName }
        } else {
          profile = snap.data() as UserProfileDoc
        }

        const fields = directoryFieldsForUser(u, profile)
        await setDoc(
          doc(getDb(), 'directoryUsers', u.uid),
          {
            ...fields,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
      } catch (e) {
        console.warn(
          '[ScoreTrack] Could not sync user profile in Firestore. Deploy firestore.rules (users/{uid}, directoryUsers) or check Firebase Console → Firestore → Rules.',
          e,
        )
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async signIn(email, password) {
        await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
      },
      async sendPasswordReset(email) {
        await sendPasswordResetEmail(getFirebaseAuth(), email)
      },
      async signInWithGoogle() {
        await signInWithPopup(getFirebaseAuth(), googleProvider)
      },
      async signUp(email, password, displayName, mobile) {
        const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
        const dn = displayName ?? email
        await updateProfile(cred.user, { displayName: dn })
        const mobRaw = mobile?.trim() ?? ''
        if (!mobRaw) {
          throw new Error('Mobile number is required.')
        }
        const mob = normalizeOptionalTenDigitMobile(mobRaw)
        if (!mob) {
          throw new Error(MOBILE_TEN_DIGIT_MSG)
        }
        await setDoc(doc(getDb(), 'users', cred.user.uid), {
          displayName: dn,
          createdAt: serverTimestamp(),
          mobile: mob,
        })
        const fields = directoryFieldsForUser(cred.user, { displayName: dn, mobile: mob })
        await setDoc(
          doc(getDb(), 'directoryUsers', cred.user.uid),
          {
            ...fields,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
      },
      async updateProfileContact(patch) {
        const auth = getFirebaseAuth()
        const u = auth.currentUser
        if (!u) throw new Error('Not signed in')

        const ref = doc(getDb(), 'users', u.uid)
        const snap = await getDoc(ref)
        const prev = snap.exists() ? (snap.data() as UserProfileDoc) : null

        let displayName = prev?.displayName ?? u.displayName ?? u.email ?? 'Player'
        let mobile = prev?.mobile ?? null

        if (patch.displayName !== undefined) {
          displayName = patch.displayName.trim() || u.email || 'Player'
        }
        if (patch.mobile !== undefined) {
          const raw = patch.mobile.trim()
          if (!raw) {
            throw new Error('Mobile number is required.')
          }
          const normalized = normalizeOptionalTenDigitMobile(raw)
          if (!normalized) {
            throw new Error(MOBILE_TEN_DIGIT_MSG)
          }
          mobile = normalized
        }

        await setDoc(
          ref,
          {
            displayName,
            mobile,
            ...(prev?.createdAt ? {} : { createdAt: serverTimestamp() }),
          },
          { merge: true },
        )

        if (patch.displayName !== undefined && patch.displayName.trim()) {
          await updateProfile(u, { displayName: patch.displayName.trim() })
        }

        const cur = getFirebaseAuth().currentUser!
        const fields = directoryFieldsForUser(cur, { displayName, mobile: mobile ?? undefined })
        await setDoc(
          doc(getDb(), 'directoryUsers', u.uid),
          {
            ...fields,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
      },
      async logout() {
        await signOut(getFirebaseAuth())
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
