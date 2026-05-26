import { doc, getDoc } from 'firebase/firestore'
import { ArrowLeft, Mail, Phone, UserRound } from 'lucide-react'
import { type FormEvent, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/useAuth'
import { BtnPendingLabel } from '../components/Spinner'
import { getDb } from '../firebase/config'
import {
  MOBILE_TEN_DIGIT_MSG,
  normalizePhoneDigits,
  parseToTenDigitMobile,
} from '../lib/phoneDigits'
import { MAX_DISPLAY_NAME_LEN, MIN_PROFILE_NAME_LEN } from '../lib/profileComplete'
import type { UserProfileDoc } from '../types/models'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ProfileFieldKey = 'fullName' | 'displayName' | 'email' | 'mobile'

type FieldErrors = Partial<Record<ProfileFieldKey, string>>

function clearFieldError(set: Dispatch<SetStateAction<FieldErrors>>, key: ProfileFieldKey) {
  set((prev) => {
    if (!prev[key]) return prev
    const next = { ...prev }
    delete next[key]
    return next
  })
}

export function ProfilePage() {
  const { user, updateProfileContact, syncCareerProfileMirror } = useAuth()
  const [fullName, setFullName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mirrorBusy, setMirrorBusy] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const snap = await getDoc(doc(getDb(), 'users', user.uid))
        if (cancelled) return
        const p = snap.exists() ? (snap.data() as UserProfileDoc) : null
        setFullName(p?.fullName?.trim() ?? '')
        setDisplayName(p?.displayName ?? user.displayName ?? '')
        const m = p?.mobile?.trim() ?? ''
        setMobile(m ? parseToTenDigitMobile(m) ?? normalizePhoneDigits(m) : '')
      } catch (e) {
        if (cancelled) return
        const msg =
          e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'permission-denied'
            ? 'Firestore permission denied — deploy firestore.rules for users and directoryUsers collections. Using sign-in data only until then.'
            : e instanceof Error
              ? e.message
              : 'Could not load profile'
        setLoadError(msg)
        setFullName('')
        setDisplayName(user.displayName ?? '')
        setMobile('')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  function validateFields(): boolean {
    const next: FieldErrors = {}
    const fn = fullName.trim()
    if (!fn) {
      next.fullName = 'Full name is required.'
    } else if (fn.length < MIN_PROFILE_NAME_LEN) {
      next.fullName = `Full name must be at least ${MIN_PROFILE_NAME_LEN} characters.`
    }

    const name = displayName.trim()
    if (!name) {
      next.displayName = 'Display name is required.'
    } else if (name.length < MIN_PROFILE_NAME_LEN) {
      next.displayName = `Display name must be at least ${MIN_PROFILE_NAME_LEN} characters.`
    } else if (name.length > MAX_DISPLAY_NAME_LEN) {
      next.displayName = `Display name must be at most ${MAX_DISPLAY_NAME_LEN} characters.`
    }

    const email = user?.email?.trim()
    if (!email) {
      next.email = 'Email is required for your account. Try signing in again with a provider that includes an email.'
    }

    const mobileTrim = mobile.trim()
    if (!mobileTrim) {
      next.mobile = 'Mobile number is required.'
    } else if (!parseToTenDigitMobile(mobile)) {
      next.mobile = MOBILE_TEN_DIGIT_MSG
    }

    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitError(null)
    setSaved(false)

    if (!validateFields()) return

    const normMobile = parseToTenDigitMobile(mobile.trim())!
    setSaving(true)
    try {
      await updateProfileContact({
        fullName: fullName.trim(),
        displayName: displayName.trim(),
        mobile: normMobile,
      })
      setMobile(normMobile)
      setFieldErrors({})
      setSaved(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-lg pb-8">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    )
  }

  const fieldShell =
    'flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 transition-[box-shadow,border-color] focus-within:border-primary/35 focus-within:shadow-[0_0_0_3px_rgba(229,9,20,0.12)]'
  const fieldShellError =
    'border-red-400 focus-within:border-red-500 focus-within:shadow-[0_0_0_3px_rgba(248,113,113,0.22)]'
  const innerInput =
    'h-9 flex-1 border-0 bg-transparent px-0 py-0 text-slate-900 shadow-none placeholder:text-placeholder-foreground focus-visible:ring-0 md:text-sm'

  return (
    <div className="mx-auto w-full max-w-lg pb-8">
      <Link
        to="/app/matches"
        className={cn(
          'mb-6 inline-flex items-center gap-1.5 text-sm font-semibold no-underline hover:underline',
          '!text-primary hover:!text-primary visited:!text-primary',
        )}
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        Matches
      </Link>

      <header className="mb-6 flex gap-4">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          aria-hidden
        >
          <UserRound className="size-6" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your profile</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Full name is required on file; display name (short) and mobile are used in squads and directory. Email comes
            from your sign-in account.
          </p>
        </div>
      </header>

      {loadError && (
        <div
          className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-snug text-amber-950"
          role="alert"
        >
          {loadError}
        </div>
      )}

      <form
        noValidate
        onSubmit={onSubmit}
        className="space-y-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] sm:p-6"
      >
        <div className="space-y-2">
          <label htmlFor="profile-full-name" className="block text-sm font-semibold text-slate-900">
            Full name <span className="font-normal text-slate-500">required</span>
          </label>
          <div className={cn(fieldShell, fieldErrors.fullName && fieldShellError)}>
            <UserRound className="size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
            <Input
              id="profile-full-name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                clearFieldError(setFieldErrors, 'fullName')
              }}
              autoComplete="name"
              placeholder="Enter your full name"
              aria-invalid={Boolean(fieldErrors.fullName)}
              aria-describedby={fieldErrors.fullName ? 'profile-full-name-error' : undefined}
              className={innerInput}
            />
          </div>
          {fieldErrors.fullName ? (
            <p id="profile-full-name-error" className="text-sm text-red-600" role="alert">
              {fieldErrors.fullName}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="profile-display-name" className="block text-sm font-semibold text-slate-900">
            Display name <span className="font-normal text-slate-500">(max {MAX_DISPLAY_NAME_LEN} characters)</span>
          </label>
          <div className={cn(fieldShell, fieldErrors.displayName && fieldShellError)}>
            <UserRound className="size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
            <Input
              id="profile-display-name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value.slice(0, MAX_DISPLAY_NAME_LEN))
                clearFieldError(setFieldErrors, 'displayName')
              }}
              autoComplete="nickname"
              maxLength={MAX_DISPLAY_NAME_LEN}
              placeholder="Short name shown in the app"
              aria-invalid={Boolean(fieldErrors.displayName)}
              aria-describedby={
                fieldErrors.displayName ? 'profile-display-name-error' : 'profile-display-name-hint'
              }
              className={innerInput}
            />
          </div>
          {fieldErrors.displayName ? (
            <p id="profile-display-name-error" className="text-sm text-red-600" role="alert">
              {fieldErrors.displayName}
            </p>
          ) : (
            <p id="profile-display-name-hint" className="text-xs leading-snug text-slate-500">
              Used in squads and directory search.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="profile-email" className="block text-sm font-semibold text-slate-900">
            Email
          </label>
          <div className={cn(fieldShell, 'bg-slate-50', fieldErrors.email && fieldShellError)}>
            <Mail className="size-4 shrink-0 text-slate-400" aria-hidden />
            <Input
              id="profile-email"
              value={user.email ?? ''}
              readOnly
              disabled
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'profile-email-error' : undefined}
              className={cn(innerInput, 'cursor-not-allowed text-slate-600')}
            />
          </div>
          {fieldErrors.email ? (
            <p id="profile-email-error" className="text-sm text-red-600" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="profile-mobile" className="block text-sm font-semibold text-slate-900">
            Mobile number <span className="font-normal text-slate-500">required</span>
          </label>
          <div className={cn(fieldShell, fieldErrors.mobile && fieldShellError)}>
            <Phone
              className={cn('size-4 shrink-0', fieldErrors.mobile ? 'text-red-500' : 'text-slate-500')}
              aria-hidden
            />
            <Input
              id="profile-mobile"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value)
                clearFieldError(setFieldErrors, 'mobile')
              }}
              type="tel"
              placeholder="9876543210"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={14}
              aria-invalid={Boolean(fieldErrors.mobile)}
              aria-describedby={fieldErrors.mobile ? 'profile-mobile-error' : 'profile-mobile-hint'}
              className={innerInput}
            />
          </div>
          {!fieldErrors.mobile ? (
            <p id="profile-mobile-hint" className="text-xs leading-snug text-slate-500">
              Ten digits; you can paste +91 or a leading 0 — we store the plain number for directory search.
            </p>
          ) : (
            <p id="profile-mobile-error" className="text-sm text-red-600" role="alert">
              {fieldErrors.mobile}
            </p>
          )}
        </div>

        {submitError && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            role="alert"
          >
            {submitError}
          </div>
        )}

        {saved && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            Profile saved.
          </div>
        )}

        <Button
          type="submit"
          variant="default"
          disabled={saving}
          className="h-12 w-full rounded-xl text-base font-semibold !text-primary-foreground shadow-md"
        >
          <BtnPendingLabel pending={saving} idle="Save profile" />
        </Button>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="mb-2 text-xs leading-snug text-slate-600">
            Your public career URL reads names from a copy stored with your stats. Tap below if your name on{' '}
            <span className="whitespace-nowrap">/player/…</span> looks wrong after saving or signing in.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={mirrorBusy || loading}
            className="h-10 w-full rounded-xl text-sm font-semibold"
            onClick={() => {
              setMirrorBusy(true)
              void (async () => {
                try {
                  await syncCareerProfileMirror()
                  toast.success('Public player page updated.')
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not sync.')
                } finally {
                  setMirrorBusy(false)
                }
              })()
            }}
          >
            <BtnPendingLabel pending={mirrorBusy} idle="Sync names to public player page" />
          </Button>
        </div>
      </form>
    </div>
  )
}
