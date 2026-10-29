import type { User } from 'firebase/auth'
import type { UserProfileDoc } from '../types/models'
import { normalizePhoneDigits } from '../lib/phoneDigits'

/**
 * Fields written to `directoryUsers/{uid}` (plus `updatedAt` from caller).
 */
export function directoryFieldsForUser(u: User, profile: Partial<UserProfileDoc> | undefined) {
  const displayName =
    (profile?.displayName && String(profile.displayName).trim()) ||
    u.displayName ||
    u.email ||
    'Player'
  const fullName = profile?.fullName?.trim() ?? ''
  const email = u.email ?? null
  const mobileDigits = normalizePhoneDigits(profile?.mobile ?? '')

  return {
    displayName,
    displayNameLower: displayName.toLowerCase(),
    ...(fullName
      ? { fullName, fullNameLower: fullName.toLowerCase() }
      : { fullName: null, fullNameLower: null }),
    email,
    emailLower: email ? email.toLowerCase() : null,
    phoneDigits: mobileDigits.length > 0 ? mobileDigits : null,
    photoURL: u.photoURL ?? null,
  }
}
