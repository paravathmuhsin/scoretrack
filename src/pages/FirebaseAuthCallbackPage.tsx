import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getAuthErrorMessage } from '../auth/authErrors'
import { completeGoogleRedirectIfNeeded } from '../auth/googleSignIn'
import { Spinner } from '../components/Spinner'
import { getFirebaseAuth } from '../firebase/config'
import { safePostAuthPath } from '../lib/safeRedirect'

/** Firebase Google redirect lands here (`/__/auth/handler?…`). */
export function FirebaseAuthCallbackPage() {
  const nav = useNavigate()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const cred = await completeGoogleRedirectIfNeeded(getFirebaseAuth())
        if (cancelled) return
        if (cred?.user) {
          nav(safePostAuthPath(new URLSearchParams(window.location.search).get('redirect')), {
            replace: true,
          })
          return
        }
        nav('/login', { replace: true })
      } catch (err) {
        if (cancelled) return
        toast.error(getAuthErrorMessage(err))
        nav('/login', { replace: true })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [nav])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6">
      <Spinner label="Signing in" />
      <p className="text-sm text-muted-foreground">Signing in…</p>
    </div>
  )
}
