import { Capacitor } from '@capacitor/core'
import { PUBLIC_APP_DOMAIN } from './appDomain'

const ANDROID_PACKAGE = 'com.scoretrack.app'

export { ANDROID_PACKAGE }

export function isMobileWebBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** Public paths that are commonly shared (live match, player, tournament). */
export function isShareablePublicPath(pathname: string): boolean {
  return (
    /^\/live\/[^/]+/.test(pathname) ||
    /^\/player\/[^/]+/.test(pathname) ||
    /^\/tournaments\/[^/]+/.test(pathname)
  )
}

function toHttpsUrl(rawUrl: string): string {
  const url = new URL(rawUrl)
  url.protocol = 'https:'
  url.hostname = url.hostname.replace(/^www\./, '') || PUBLIC_APP_DOMAIN
  return url.toString()
}

/** Android intent URL that launches the installed app (works from in-app browsers). */
export function androidAppIntentUrl(rawUrl: string): string {
  const httpsUrl = toHttpsUrl(rawUrl)
  const url = new URL(httpsUrl)
  const path = `${url.host}${url.pathname}${url.search}${url.hash}`
  const fallback = encodeURIComponent(httpsUrl)
  return `intent://${path}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`
}

export function openInAppUrl(rawUrl: string): string {
  if (Capacitor.isNativePlatform()) return rawUrl
  if (/Android/i.test(navigator.userAgent)) return androidAppIntentUrl(rawUrl)
  return toHttpsUrl(rawUrl)
}

export function shouldOfferOpenInApp(): boolean {
  if (Capacitor.isNativePlatform()) return false
  if (!isMobileWebBrowser()) return false
  if (typeof window === 'undefined') return false
  return isShareablePublicPath(window.location.pathname)
}

/** True when Chrome detects the Android app via Digital Asset Links (installed + verified). */
export async function isAndroidAppInstalled(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  if (!/Android/i.test(navigator.userAgent)) return false
  if (!('getInstalledRelatedApps' in navigator)) return false

  try {
    const apps = await (
      navigator as Navigator & {
        getInstalledRelatedApps: () => Promise<Array<{ id?: string; platform?: string }>>
      }
    ).getInstalledRelatedApps()
    return apps.some((app) => app.id === ANDROID_PACKAGE)
  } catch {
    return false
  }
}
