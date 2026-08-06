import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { Capacitor } from '@capacitor/core'
import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithPopup,
  type Auth,
  type UserCredential,
} from 'firebase/auth'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

function isCredentialManagerSignInError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /no credentials available|credential manager|GetCredentialException|no credential/i.test(msg)
}

const nativeGoogleOptions = {
  /** Match capacitor.config — JS SDK owns the Firebase Auth session. */
  skipNativeAuth: true,
} as const

async function signInWithGoogleNative(options?: { clearSession?: boolean }) {
  if (options?.clearSession !== false) {
    // Clear cached Google session so a previous account is not reused silently.
    await FirebaseAuthentication.signOut().catch(() => {})
  }

  try {
    return await FirebaseAuthentication.signInWithGoogle({
      ...nativeGoogleOptions,
      // Credential Manager shows the account chooser (all device accounts).
      useCredentialManager: true,
    })
  } catch (err) {
    if (!isCredentialManagerSignInError(err)) throw err
    // Fallback for emulators / devices where Credential Manager is unavailable.
    return await FirebaseAuthentication.signInWithGoogle({
      ...nativeGoogleOptions,
      useCredentialManager: false,
    })
  }
}

/** Native apps use the platform Google account picker (not WebView redirect). */
export function usesNativeGoogleSignIn(): boolean {
  return Capacitor.isNativePlatform()
}

/** @deprecated Use usesNativeGoogleSignIn */
export const usesNativeGoogleRedirect = usesNativeGoogleSignIn

/** Clear native Google / plugin session (no-op on web). */
export async function signOutNativeAuth(): Promise<void> {
  if (!usesNativeGoogleSignIn()) return
  await FirebaseAuthentication.signOut().catch(() => {})
}

/** Web-only redirect completion; native uses signInWithCredential instead. */
export async function completeGoogleRedirectIfNeeded(_auth: Auth): Promise<UserCredential | null> {
  return null
}

export async function signInWithGoogle(auth: Auth): Promise<UserCredential | null> {
  if (usesNativeGoogleSignIn()) {
    const result = await signInWithGoogleNative()
    const idToken = result.credential?.idToken
    if (!idToken) return null
    const credential = GoogleAuthProvider.credential(idToken)
    return signInWithCredential(auth, credential)
  }
  return signInWithPopup(auth, googleProvider)
}

/** Re-authenticate the current user before sensitive actions (e.g. account deletion). */
export async function reauthenticateWithGoogle(auth: Auth): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')

  if (usesNativeGoogleSignIn()) {
    const result = await signInWithGoogleNative({ clearSession: false })
    const idToken = result.credential?.idToken
    if (!idToken) throw new Error('Google confirmation was cancelled.')
    await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken))
    return
  }

  await reauthenticateWithPopup(user, googleProvider)
}
