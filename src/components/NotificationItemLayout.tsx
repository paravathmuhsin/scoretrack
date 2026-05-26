import { deleteDoc, doc } from 'firebase/firestore'
import { Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { getDb } from '../firebase/config'
import { cn } from '@/lib/utils'

type Props = {
  notificationId: string
  uid: string
  isUnread: boolean
  disabled?: boolean
  className?: string
  onMarkRead?: () => void | Promise<void>
  children: ReactNode
}

export function NotificationItemLayout({
  notificationId,
  uid,
  isUnread,
  disabled = false,
  className,
  onMarkRead,
  children,
}: Props) {
  async function remove() {
    await deleteDoc(doc(getDb(), 'users', uid, 'notifications', notificationId))
  }

  return (
    <li
      className={cn(
        'relative h-auto min-h-0 w-full rounded-xl border py-3 pl-4 pr-11',
        isUnread ? 'border-primary/25 bg-primary/[0.04]' : 'border-slate-100 bg-white',
        className,
      )}
    >
      <button
        type="button"
        className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-destructive disabled:opacity-50"
        aria-label="Delete notification"
        disabled={disabled}
        onClick={() => void remove()}
      >
        <Trash2 className="size-4" strokeWidth={2} aria-hidden />
      </button>
      <div className="min-w-0">{children}</div>
      {isUnread && onMarkRead ? (
        <button
          type="button"
          className="mt-2 text-xs font-medium text-primary hover:underline disabled:opacity-50"
          disabled={disabled}
          onClick={() => void onMarkRead()}
        >
          Mark as read
        </button>
      ) : null}
    </li>
  )
}
