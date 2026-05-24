import { Capacitor } from '@capacitor/core'
import { PUBLIC_APP_DOMAIN } from './appDomain'

const ANDROID_PACKAGE = 'com.scoretrack.app'

export { ANDROID_PACKAGE }

/** Set when the native app was confirmed installed (API or successful launch). */
export const ANDROID_APP_INSTALLED_KEY = 'st-android-app-installed'

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

function readStoredAndroidAppInstalled(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(ANDROID_APP_INSTALLED_KEY) === '1'
}

export function markAndroidAppInstalled(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(ANDROID_APP_INSTALLED_KEY, '1')
}

async function isAndroidAppInstalledViaApi(): Promise<boolean | null> {
  if (typeof navigator === 'undefined') return null
  if (!/Android/i.test(navigator.userAgent)) return false
  if (!('getInstalledRelatedApps' in navigator)) return null

  try {
    const apps = await (
      navigator as Navigator & {
        getInstalledRelatedApps: () => Promise<Array<{ id?: string }>>
      }
    ).getInstalledRelatedApps()
    return apps.some((app) => app.id === ANDROID_PACKAGE)
  } catch {
    return null
  }
}

/** Detect installed Android app via Chrome API or a prior successful app launch. */
export async function resolveAndroidAppInstalled(): Promise<boolean> {
  if (readStoredAndroidAppInstalled()) return true

  const viaApi = await isAndroidAppInstalledViaApi()
  if (viaApi === true) {
    markAndroidAppInstalled()
    return true
  }

  return false
}

/** @deprecated Use `resolveAndroidAppInstalled()`. */
export async function isAndroidAppInstalled(): Promise<boolean> {
  return resolveAndroidAppInstalled()
}

/** Launch the Android app; remember install when the browser hands off to the app. */
export function launchAndroidApp(rawUrl: string): void {
  let marked = false

  const markIfOpened = () => {
    if (marked || !document.hidden) return
    marked = true
    markAndroidAppInstalled()
  }

  const onVisibility = () => markIfOpened()

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', markIfOpened)
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', markIfOpened)
  }, 3000)

  window.location.assign(openInAppUrl(rawUrl))
}
