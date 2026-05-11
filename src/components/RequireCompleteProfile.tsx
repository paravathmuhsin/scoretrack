import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getDb } from '../firebase/config'
import { isProfileComplete } from '../lib/profileComplete'
import type { UserProfileDoc } from '../types/models'

/**
 * Blocks shell routes until Firestore profile has a valid 10-digit mobile and a display name (≥2 chars from profile or Auth).
 */
export function RequireCompleteProfile() {
  const { user } = useAuth()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const snap = await getDoc(doc(getDb(), 'users', user.uid))
        const profile = snap.exists() ? (snap.data() as UserProfileDoc) : null
        if (!cancelled) setComplete(isProfileComplete(profile, user))
      } catch {
        if (!cancelled) setComplete(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) {
    if (location.pathname === '/app/my-stats') return <Outlet />
    return null
  }
  if (loading) {
    return (
      <div className="main">
        <p className="muted">Loading…</p>
      </div>
    )
  }
  if (!complete) return <Navigate to="/app/complete-profile" replace />
  return <Outlet />
}
