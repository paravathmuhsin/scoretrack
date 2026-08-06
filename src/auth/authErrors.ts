import { FirebaseError } from 'firebase/app'

const GOOGLE_DEVELOPER_ERROR_HELP =
  'Google Sign-In is not configured for this build. In Firebase Console → Project settings → your Android app, add the SHA-1 for the APK you installed (run npm run cap:android:sha). Then download a new google-services.json and run npm run cap:android:firebase && npm run cap:sync.'

function readErrorCode(err: unknown): string | number | undefined {
  if (typeof err !== 'object' || err === null) return undefined
  const code = (err as { code?: string | number }).code
  return code
}

function isGoogleDeveloperError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const code = readErrorCode(err)
  if (code === 10 || code === '10') return true
  return /DEVELOPER_ERROR|^10\b|^10:\s*$/i.test(message)
}

export function getAuthErrorMessage(err: unknown): string {
  if (isGoogleDeveloperError(err)) {
    return GOOGLE_DEVELOPER_ERROR_HELP
  }

  const message = err instanceof Error ? err.message : ''
  if (/no credentials available/i.test(message)) {
    return 'No Google account found. Add a Google account in device Settings, then try again.'
  }
  if (err instanceof Error && /reading 'app'|Cannot read properties of undefined/i.test(err.message)) {
    return 'Sign-in confirmation failed. Try again, or use email/password if your account supports it.'
  }
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
      case 'auth/redirect-cancelled-by-user':
        return 'Sign-in was cancelled.'
      case 'auth/argument-error':
        return 'Sign-in could not start. Update the app and try again.'
      case 'auth/unauthorized-domain':
        return 'This app is not authorized for sign-in. Contact support if this continues.'
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using a different sign-in method.'
      case 'auth/requires-recent-login':
        return 'For security, confirm your identity again (password or Google), then retry.'
      case 'auth/configuration-not-found':
        return import.meta.env.MODE === 'staging'
          ? 'Staging Firebase Auth is not set up yet. In Firebase Console → scoretrack-staging → Authentication, click Get started, then enable Email/Password and Google. Add localhost under Authorized domains.'
          : 'Firebase Authentication is not configured for this project. In Firebase Console → Authentication, enable at least one sign-in method (Email/Password and/or Google).'
      default:
        return err.message
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong'
}
