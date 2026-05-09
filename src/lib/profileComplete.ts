import type { User } from 'firebase/auth'
import type { UserProfileDoc } from '../types/models'
import { parseToTenDigitMobile } from './phoneDigits'

export const MIN_PROFILE_NAME_LEN = 2

const MIN_NAME_LEN = MIN_PROFILE_NAME_LEN

/** Display name from Firestore or Auth; must be at least MIN_NAME_LEN characters. */
export function effectiveDisplayName(profile: UserProfileDoc | null | undefined, authUser: User): string {
  const fromDoc = profile?.displayName?.trim() ?? ''
  if (fromDoc.length >= MIN_NAME_LEN) return fromDoc
  const fromAuth = authUser.displayName?.trim() ?? ''
  if (fromAuth.length >= MIN_NAME_LEN) return fromAuth
  return ''
}

/** Required before using the app: real display name + 10-digit mobile in profile. */
export function isProfileComplete(profile: UserProfileDoc | null | undefined, authUser: User): boolean {
  if (!parseToTenDigitMobile(profile?.mobile ?? '')) return false
  return effectiveDisplayName(profile, authUser).length >= MIN_NAME_LEN
}
