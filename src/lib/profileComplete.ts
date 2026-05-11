import type { User } from 'firebase/auth'
import type { UserProfileDoc } from '../types/models'
import { parseToTenDigitMobile } from './phoneDigits'

export const MIN_PROFILE_NAME_LEN = 2
/** Short handle shown in UI and directory (Firebase Auth displayName matches). */
export const MAX_DISPLAY_NAME_LEN = 12

const MIN_NAME_LEN = MIN_PROFILE_NAME_LEN

/** Display name from Firestore or Auth; must be at least MIN_NAME_LEN characters. */
export function effectiveDisplayName(profile: UserProfileDoc | null | undefined, authUser: User): string {
  const fromDoc = profile?.displayName?.trim() ?? ''
  if (fromDoc.length >= MIN_NAME_LEN) return fromDoc
  const fromAuth = authUser.displayName?.trim() ?? ''
  if (fromAuth.length >= MIN_NAME_LEN) return fromAuth
  return ''
}

/** Full name from Firestore only (not mirrored on Firebase Auth). */
export function effectiveFullName(profile: UserProfileDoc | null | undefined): string {
  return profile?.fullName?.trim() ?? ''
}

/** Required before using the app: full name + short display name + 10-digit mobile. */
export function isProfileComplete(profile: UserProfileDoc | null | undefined, authUser: User): boolean {
  if (!parseToTenDigitMobile(profile?.mobile ?? '')) return false
  if (effectiveFullName(profile).length < MIN_NAME_LEN) return false
  const disp = effectiveDisplayName(profile, authUser)
  if (disp.length < MIN_NAME_LEN || disp.length > MAX_DISPLAY_NAME_LEN) return false
  return true
}
