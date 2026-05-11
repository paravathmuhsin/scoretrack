/**
 * Returns a safe in-app path for post-login navigation. Rejects protocol-relative
 * and absolute URLs to avoid open redirects.
 */
export function safePostAuthPath(redirect: string | null | undefined): string {
  if (redirect == null || typeof redirect !== 'string') return '/'
  const t = redirect.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return '/'
  return t
}

export function withRedirectQuery(path: string, redirect: string | null | undefined): string {
  const safe = safePostAuthPath(redirect)
  if (safe === '/') return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}redirect=${encodeURIComponent(safe)}`
}
