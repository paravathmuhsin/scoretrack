import { Capacitor } from '@capacitor/core'

const ANDROID_PACKAGE = 'com.scoretrackonline.app'

/** Default Google Play listing for ScoreTrack Android. */
export const DEFAULT_ANDROID_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`

function readPlayStoreUrlEnv(): string | undefined {
  // Prefer Play Store env; empty string disables the prompt.
  if (import.meta.env.VITE_ANDROID_PLAY_STORE_URL !== undefined) {
    return import.meta.env.VITE_ANDROID_PLAY_STORE_URL.trim()
  }
  // Legacy: empty VITE_ANDROID_APK_URL still disables the prompt.
  if (import.meta.env.VITE_ANDROID_APK_URL === '') return ''
  return undefined
}

/** Google Play Store URL (`VITE_ANDROID_PLAY_STORE_URL` or default listing). */
export function getAndroidPlayStoreUrl(): string {
  const fromEnv = readPlayStoreUrlEnv()
  if (fromEnv !== undefined) return fromEnv
  return DEFAULT_ANDROID_PLAY_STORE_URL
}

/** Whether the Play Store install prompt should be shown (set env to empty to disable). */
export function isAndroidPlayStorePromptEnabled(): boolean {
  if (import.meta.env.VITE_ANDROID_PLAY_STORE_URL === '') return false
  if (import.meta.env.VITE_ANDROID_APK_URL === '') return false
  return Boolean(getAndroidPlayStoreUrl())
}

/**
 * True only in an Android *browser* (Chrome/Firefox/etc on Android).
 * False for iOS, desktop, and the native Capacitor app.
 */
export function isAndroidWebBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  if (Capacitor.isNativePlatform()) return false

  const uaData = (
    navigator as Navigator & {
      userAgentData?: { platform?: string; mobile?: boolean }
    }
  ).userAgentData
  if (uaData?.platform) {
    if (!/Android/i.test(uaData.platform)) return false
  }

  const ua = navigator.userAgent
  if (!/Android/i.test(ua)) return false
  if (/iPhone|iPad|iPod/i.test(ua)) return false

  return true
}

/** @deprecated Use `getAndroidPlayStoreUrl()`. */
export function getAndroidApkDownloadUrl(): string {
  return getAndroidPlayStoreUrl()
}

/** @deprecated Use `isAndroidPlayStorePromptEnabled()`. */
export function isAndroidApkDownloadEnabled(): boolean {
  return isAndroidPlayStorePromptEnabled()
}

/** @deprecated Prefer `getAndroidPlayStoreUrl()`. */
export const ANDROID_APK_PATH = DEFAULT_ANDROID_PLAY_STORE_URL
