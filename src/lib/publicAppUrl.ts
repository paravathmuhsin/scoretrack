import { PUBLIC_APP_HOSTS } from './appDomain'

/** Production web app URL (custom domain on Firebase Hosting). */
export const DEFAULT_PUBLIC_APP_URL = 'https://scoretrackonline.com'

function readPublicAppUrlEnv(): string {
  const v = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined
  return v?.trim() ?? ''
}

function isEmbeddedAppOrigin(origin: string): boolean {
  if (!origin) return true
  if (origin.startsWith('capacitor://') || origin.startsWith('ionic://')) return true
  try {
    const { hostname, protocol } = new URL(origin)
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    if ((PUBLIC_APP_HOSTS as readonly string[]).includes(hostname)) return true
    if (protocol === 'file:') return true
  } catch {
    return true
  }
  return false
}

/** Origin used in shared/copied links (live match, overlay, invites). */
export function getPublicAppOrigin(): string {
  const fromEnv = readPublicAppUrlEnv()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    if (!isEmbeddedAppOrigin(origin)) return origin
  }

  return DEFAULT_PUBLIC_APP_URL
}

/** Absolute URL for a public app path, e.g. `/live/abc`. */
export function publicAppUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getPublicAppOrigin()}${normalized}`
}
