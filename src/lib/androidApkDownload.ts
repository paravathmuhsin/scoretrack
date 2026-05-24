/** Filename suggested when the browser saves the APK. */
export const ANDROID_APK_FILE_NAME = 'ScoreTrack.apk'

const DEFAULT_ANDROID_APK_URL =
  'https://github.com/paravathmuhsin/scoretrack/releases/latest/download/ScoreTrack.apk'

function readAndroidApkUrlEnv(): string {
  return import.meta.env.VITE_ANDROID_APK_URL?.trim() ?? ''
}

/** Direct download URL for the Android APK (`VITE_ANDROID_APK_URL` or GitHub releases default). */
export function getAndroidApkDownloadUrl(): string {
  const fromEnv = readAndroidApkUrlEnv()
  if (fromEnv) return fromEnv
  return DEFAULT_ANDROID_APK_URL
}

/** Whether the download prompt should be shown (set `VITE_ANDROID_APK_URL=` empty to disable). */
export function isAndroidApkDownloadEnabled(): boolean {
  if (import.meta.env.VITE_ANDROID_APK_URL === '') return false
  return Boolean(getAndroidApkDownloadUrl())
}

/** @deprecated Prefer `getAndroidApkDownloadUrl()`. */
export const ANDROID_APK_PATH = getAndroidApkDownloadUrl()
