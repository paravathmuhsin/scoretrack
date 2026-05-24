import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { Capacitor } from '@capacitor/core'
import {
  GoogleAuthProvider,
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

async function signInWithGoogleNative() {
  // Clear cached Google session so a previous account is not reused silently.
  await FirebaseAuthentication.signOut().catch(() => {})

  try {
    return await FirebaseAuthentication.signInWithGoogle({
      // Credential Manager shows the account chooser (all device accounts).
      useCredentialManager: true,
    })
  } catch (err) {
    if (!isCredentialManagerSignInError(err)) throw err
    // Fallback for emulators / devices where Credential Manager is unavailable.
    return await FirebaseAuthentication.signInWithGoogle({
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
