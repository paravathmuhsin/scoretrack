import { FirebaseError } from 'firebase/app'

export function getAuthErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password.'
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled.'
      case 'auth/popup-blocked':
        return 'Pop-up was blocked. Allow pop-ups for this site and try again.'
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using a different sign-in method.'
      default:
        return err.message
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong'
}
