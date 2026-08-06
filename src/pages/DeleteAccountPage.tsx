import { ArrowLeft, Lock, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAuthErrorMessage } from '../auth/authErrors'
import { useAuth } from '../auth/useAuth'
import { BtnPendingLabel } from '../components/Spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function DeleteAccountPage() {
  const { user, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const usesPassword = useMemo(
    () => user?.providerData.some((p) => p.providerId === 'password') ?? false,
    [user],
  )
  const usesGoogle = useMemo(
    () => user?.providerData.some((p) => p.providerId === 'google.com') ?? false,
    [user],
  )

  if (!user) return null

  const fieldShell =
    'flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 transition-[box-shadow,border-color] focus-within:border-primary/35 focus-within:shadow-[0_0_0_3px_rgba(229,9,20,0.12)]'
  const innerInput =
    'h-9 flex-1 border-0 bg-transparent px-0 py-0 text-slate-900 shadow-none placeholder:text-placeholder-foreground focus-visible:ring-0 md:text-sm'

  async function onDelete() {
    if (!confirmed) {
      setError('Check the box to confirm you understand this is permanent.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await deleteAccount(usesPassword ? password : undefined)
      navigate('/', { replace: true })
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg pb-8">
      <Link
        to="/app/profile"
        className={cn(
          'mb-6 inline-flex items-center gap-1.5 text-sm font-semibold no-underline hover:underline',
          '!text-primary hover:!text-primary visited:!text-primary',
        )}
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        Profile
      </Link>

      <header className="mb-6 flex gap-4">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
          aria-hidden
        >
          <Trash2 className="size-6" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Delete account</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Permanently remove your ScoreTrack account and profile. This cannot be undone.
          </p>
        </div>
      </header>

      <div className="space-y-5 rounded-2xl border border-red-100 bg-white p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-950">
          <p className="font-semibold">What will be deleted</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your login and profile (name, email, mobile)</li>
            <li>Your directory listing and notifications</li>
          </ul>
          <p className="mt-3">
            Matches, teams, and tournaments you created may remain for other players. Public player
            stats may show as &quot;Deleted user&quot; where your account ID appears in scorecards.
          </p>
        </div>

        {usesPassword ? (
          <div className="space-y-2">
            <label htmlFor="delete-password" className="block text-sm font-semibold text-slate-900">
              Confirm with your password
            </label>
            <div className={fieldShell}>
              <Lock className="size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                placeholder="Enter your password"
                className={innerInput}
              />
            </div>
          </div>
        ) : usesGoogle ? (
          <p className="text-sm text-slate-600">
            You&apos;ll be asked to confirm with Google before your account is deleted.
          </p>
        ) : null}

        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-700">
          <input
            type="checkbox"
            className="mt-1 size-4 rounded border-slate-300"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={busy}
          />
          <span>I understand this permanently deletes my account and cannot be reversed.</span>
        </label>

        {error ? (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <Button
          type="button"
          variant="destructive"
          className="h-11 w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
          disabled={busy || !confirmed}
          onClick={() => void onDelete()}
        >
          <BtnPendingLabel
            pending={busy}
            idle="Delete my account permanently"
            busyText="Deleting account…"
          />
        </Button>
      </div>
    </div>
  )
}
