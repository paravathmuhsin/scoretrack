import { Capacitor } from '@capacitor/core'
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
  type UserCredential,
} from 'firebase/auth'

const googleProvider = new GoogleAuthProvider()

/** Firebase popups fail in Capacitor WebViews; use redirect + deep link instead. */
export function usesNativeGoogleRedirect(): boolean {
  return Capacitor.isNativePlatform()
}

/** Call once on startup so returning from Google OAuth completes sign-in. */
export async function completeGoogleRedirectIfNeeded(auth: Auth): Promise<UserCredential | null> {
  if (!usesNativeGoogleRedirect()) return null
  try {
    return await getRedirectResult(auth)
  } catch (err) {
    console.error('[ScoreTrack] Google redirect sign-in failed.', err)
    throw err
  }
}

export async function signInWithGoogle(auth: Auth): Promise<UserCredential | null> {
  if (usesNativeGoogleRedirect()) {
    await signInWithRedirect(auth, googleProvider)
    return null
  }
  return signInWithPopup(auth, googleProvider)
}
