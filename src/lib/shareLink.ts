import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'

export type ShareLinkResult = 'shared' | 'copied' | 'cancelled'

function isShareCancelled(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  const msg = err instanceof Error ? err.message : String(err)
  return /cancel/i.test(msg)
}

/**
 * Opens the native share sheet on mobile; Web Share API in the browser; copies as fallback.
 */
export async function shareLink(options: {
  url: string
  title?: string
  text?: string
}): Promise<ShareLinkResult> {
  const { url, title, text } = options

  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title: title ?? 'Share',
        text: text ?? url,
        url,
        dialogTitle: title ?? 'Share link',
      })
      return 'shared'
    } catch (err) {
      if (isShareCancelled(err)) return 'cancelled'
    }
  } else if (typeof navigator.share === 'function') {
    const payloads: ShareData[] = [
      { title, text, url },
      { title, url },
      { text, url },
      { url },
    ]
    for (const data of payloads) {
      try {
        if (typeof navigator.canShare === 'function' && !navigator.canShare(data)) continue
        await navigator.share(data)
        return 'shared'
      } catch (err) {
        if (isShareCancelled(err)) return 'cancelled'
      }
    }
  }

  await navigator.clipboard.writeText(url)
  return 'copied'
}
