import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { ArrowLeft, Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { NotificationRow } from '../components/NotificationRow'
import { getDb } from '../firebase/config'
import { markExpiredOwnershipTransfers } from '../lib/teamOwnershipTransfer'
import type { UserNotificationDoc } from '../types/models'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Row = UserNotificationDoc & { id: string }

const NOTIFICATIONS_PAGE_SIZE = 15

export function NotificationsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [visibleCount, setVisibleCount] = useState(NOTIFICATIONS_PAGE_SIZE)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    if (!user) return
    void markExpiredOwnershipTransfers(getDb(), user.uid).catch(() => {
      /* non-blocking housekeeping */
    })
  }, [user])

  useEffect(() => {
    if (!user) {
      setRows([])
      return
    }
    const qy = query(collection(getDb(), 'users', user.uid, 'notifications'), orderBy('createdAt', 'desc'))
    return onSnapshot(qy, (snap) => {
      const list: Row[] = []
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as UserNotificationDoc) }))
      setRows(list)
    })
  }, [user])

  useEffect(() => {
    setVisibleCount(NOTIFICATIONS_PAGE_SIZE)
  }, [user?.uid])

  useEffect(() => {
    setVisibleCount((n) => (rows.length < n ? Math.max(NOTIFICATIONS_PAGE_SIZE, rows.length) : n))
  }, [rows.length])

  if (!user) return null

  const unreadCount = rows.filter((r) => !r.readAt).length
  const visibleRows = rows.slice(0, visibleCount)
  const hasMore = visibleCount < rows.length

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-2">
      <Link
        to="/app/teams"
        className={cn(
          'inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:underline',
          '!text-primary hover:!text-primary visited:!text-primary',
        )}
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        Back
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden
          >
            <Bell className="size-6" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        {unreadCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={markingAll}
            onClick={() => {
              void (async () => {
                setMarkingAll(true)
                try {
                  const batch = writeBatch(getDb())
                  const now = Timestamp.now()
                  for (const r of rows) {
                    if (r.readAt) continue
                    batch.update(doc(getDb(), 'users', user.uid, 'notifications', r.id), { readAt: now })
                  }
                  await batch.commit()
                } finally {
                  setMarkingAll(false)
                }
              })()
            }}
          >
            Mark all read
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-10 text-center text-sm text-slate-500">
          No notifications yet.
        </p>
      ) : (
        <div className="space-y-3">
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {visibleRows.map((r) => (
              <NotificationRow key={r.id} notificationId={r.id} uid={user.uid} data={r} />
            ))}
          </ul>
          {hasMore ? (
            <button
              type="button"
              className={cn(
                'block w-full py-2 text-center text-sm font-semibold no-underline hover:underline',
                '!text-primary hover:!text-primary visited:!text-primary',
              )}
              onClick={() =>
                setVisibleCount((n) => Math.min(n + NOTIFICATIONS_PAGE_SIZE, rows.length))
              }
            >
              Load more
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
