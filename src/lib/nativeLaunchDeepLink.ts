import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { pathFromDeepLinkUrl } from './deepLinkPath'

/** Apply cold-start app/universal link URL before Firebase reads redirect params. */
export async function applyNativeLaunchDeepLink(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  const result = await App.getLaunchUrl()
  if (!result?.url) return null
  const path = pathFromDeepLinkUrl(result.url)
  if (!path) return null
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (current !== path) {
    window.history.replaceState({}, '', path)
  }
  return path
}

export function isFirebaseAuthCallbackPath(path?: string | null): boolean {
  const p = path ?? `${window.location.pathname}${window.location.search}`
  return p.includes('/__/auth/')
}
