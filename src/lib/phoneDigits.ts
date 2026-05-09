/** Keep only digits for phone search index. */
export function normalizePhoneDigits(input: string): string {
  return input.replace(/\D/g, '')
}

/** Shown when optional mobile is present but invalid. */
export const MOBILE_TEN_DIGIT_MSG =
  'Mobile must be exactly 10 digits, no spaces. You may paste +91 9876543210 — we store 9876543210.'

/**
 * Accepts exactly 10 digits, or common India wrappers (+91 / leading 0).
 * Returns null if the value cannot be interpreted as one valid 10-digit mobile.
 */
export function parseToTenDigitMobile(input: string): string | null {
  let d = normalizePhoneDigits(input.trim())
  if (d.length === 0) return null
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (d.length !== 10) return null
  return d
}

/** Non-empty input must parse to 10 digits; empty string is allowed (optional field). */
export function normalizeOptionalTenDigitMobile(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  return parseToTenDigitMobile(t)
}
