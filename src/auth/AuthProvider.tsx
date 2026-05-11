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
import { syncPlayerCareerProfileNames } from '../lib/syncPlayerCareerProfileNames'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { directoryFieldsForUser } from './userDirectory'
import { getDb, getFirebaseAuth } from '../firebase/config'
import { MOBILE_TEN_DIGIT_MSG, normalizeOptionalTenDigitMobile } from '../lib/phoneDigits'
import { MAX_DISPLAY_NAME_LEN, MIN_PROFILE_NAME_LEN } from '../lib/profileComplete'
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
          const raw = u.displayName?.trim() ?? ''
          const emailLocal = u.email?.split('@')[0]?.trim() ?? ''
          const fullNameCandidate = raw || emailLocal
          const shortFromRaw = raw.slice(0, MAX_DISPLAY_NAME_LEN)
          const shortFromEmail = emailLocal.slice(0, MAX_DISPLAY_NAME_LEN)
          const displayName =
            shortFromRaw || shortFromEmail || 'Player'.slice(0, MAX_DISPLAY_NAME_LEN)
          const fullName =
            fullNameCandidate.length >= MIN_PROFILE_NAME_LEN ? fullNameCandidate : ''
          await setDoc(ref, {
            displayName,
            ...(fullName ? { fullName } : {}),
            createdAt: serverTimestamp(),
          })
          profile = { displayName, ...(fullName ? { fullName } : {}) }
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
        try {
          await syncPlayerCareerProfileNames(
            getDb(),
            u.uid,
            profile?.fullName?.trim() ?? '',
            profile?.displayName?.trim() ?? u.displayName?.trim() ?? '',
          )
        } catch (syncErr) {
          console.warn('[ScoreTrack] Could not sync profile names to playerCareerStats.', syncErr)
        }
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
      async signUp(email, password, fullName, displayName, mobile) {
        const fn = fullName.trim()
        const dn = displayName.trim()
        if (fn.length < MIN_PROFILE_NAME_LEN) {
          throw new Error(`Full name must be at least ${MIN_PROFILE_NAME_LEN} characters.`)
        }
        if (dn.length < MIN_PROFILE_NAME_LEN) {
          throw new Error(`Display name must be at least ${MIN_PROFILE_NAME_LEN} characters.`)
        }
        if (dn.length > MAX_DISPLAY_NAME_LEN) {
          throw new Error(`Display name must be at most ${MAX_DISPLAY_NAME_LEN} characters.`)
        }
        const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
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
          fullName: fn,
          displayName: dn,
          createdAt: serverTimestamp(),
          mobile: mob,
        })
        const fields = directoryFieldsForUser(cred.user, { displayName: dn, mobile: mob, fullName: fn })
        await setDoc(
          doc(getDb(), 'directoryUsers', cred.user.uid),
          {
            ...fields,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
        try {
          await syncPlayerCareerProfileNames(getDb(), cred.user.uid, fn, dn)
        } catch (syncErr) {
          console.warn('[ScoreTrack] Could not sync profile names to playerCareerStats.', syncErr)
        }
      },
      async updateProfileContact(patch) {
        const auth = getFirebaseAuth()
        const u = auth.currentUser
        if (!u) throw new Error('Not signed in')

        const ref = doc(getDb(), 'users', u.uid)
        const snap = await getDoc(ref)
        const prev = snap.exists() ? (snap.data() as UserProfileDoc) : null

        let fullName = prev?.fullName?.trim() ?? ''
        let displayName = prev?.displayName ?? u.displayName ?? u.email ?? 'Player'
        let mobile = prev?.mobile ?? null

        if (patch.fullName !== undefined) {
          const t = patch.fullName.trim()
          if (t.length < MIN_PROFILE_NAME_LEN) {
            throw new Error(`Full name must be at least ${MIN_PROFILE_NAME_LEN} characters.`)
          }
          fullName = t
        }
        if (patch.displayName !== undefined) {
          const raw = patch.displayName.trim() || u.email?.split('@')[0]?.trim() || 'Player'
          const t = raw.slice(0, MAX_DISPLAY_NAME_LEN)
          if (t.length < MIN_PROFILE_NAME_LEN) {
            throw new Error(`Display name must be at least ${MIN_PROFILE_NAME_LEN} characters.`)
          }
          displayName = t
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
            fullName,
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
        const fields = directoryFieldsForUser(cur, {
          displayName,
          mobile: mobile ?? undefined,
          fullName: fullName || undefined,
        })
        await setDoc(
          doc(getDb(), 'directoryUsers', u.uid),
          {
            ...fields,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
        try {
          await syncPlayerCareerProfileNames(getDb(), u.uid, fullName, displayName)
        } catch (syncErr) {
          console.warn('[ScoreTrack] Could not sync profile names to playerCareerStats.', syncErr)
        }
      },
      async syncCareerProfileMirror() {
        const u = getFirebaseAuth().currentUser
        if (!u) throw new Error('Not signed in')
        const snap = await getDoc(doc(getDb(), 'users', u.uid))
        const p = snap.exists() ? (snap.data() as UserProfileDoc) : null
        const fullName = p?.fullName?.trim() ?? ''
        const displayName = p?.displayName?.trim() || u.displayName?.trim() || ''
        await syncPlayerCareerProfileNames(getDb(), u.uid, fullName, displayName)
      },
      async logout() {
        await signOut(getFirebaseAuth())
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
