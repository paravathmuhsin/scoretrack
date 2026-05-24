import { PUBLIC_APP_HOSTS } from './appDomain'

/** Map an incoming app/universal link URL to an in-app router path. */
export function pathFromDeepLinkUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    const allowedHosts = [...PUBLIC_APP_HOSTS, 'localhost', '127.0.0.1']
    if (!allowedHosts.includes(url.hostname)) return null
    const path = `${url.pathname}${url.search}${url.hash}`
    return path.startsWith('/') ? path : `/${path}`
  } catch {
    return null
  }
}
