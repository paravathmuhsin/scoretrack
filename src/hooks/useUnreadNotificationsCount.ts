import { collection, onSnapshot, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { getDb } from '../firebase/config'
import type { UserNotificationDoc } from '../types/models'

export function useUnreadNotificationsCount(): number {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) {
      setCount(0)
      return
    }
    const qy = query(collection(getDb(), 'users', user.uid, 'notifications'))
    return onSnapshot(qy, (snap) => {
      let n = 0
      snap.forEach((d) => {
        const data = d.data() as UserNotificationDoc
        if (!data.readAt) n += 1
      })
      setCount(n)
    })
  }, [user])

  return count
}
