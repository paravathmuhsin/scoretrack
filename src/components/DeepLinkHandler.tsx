import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useEffect } from 'react'
import { pathFromDeepLinkUrl } from '../lib/deepLinkPath'

function navigateToPath(path: string) {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (current === path) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** Routes https://scoretrackonline.com/live/… when opened from the native app. */
export function DeepLinkHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const open = (rawUrl: string) => {
      const path = pathFromDeepLinkUrl(rawUrl)
      if (!path) return
      navigateToPath(path)
    }

    void App.getLaunchUrl().then((result) => {
      if (result?.url) open(result.url)
    })

    let remove: (() => void) | undefined
    void App.addListener('appUrlOpen', (event) => {
      open(event.url)
    }).then((handle) => {
      remove = () => void handle.remove()
    })

    return () => remove?.()
  }, [])

  return null
}
