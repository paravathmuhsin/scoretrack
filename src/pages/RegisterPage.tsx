import { ArrowRight, Eye, EyeOff, Lock, Mail, Smartphone, User } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getAuthErrorMessage } from '../auth/authErrors'
import { useAuth } from '../auth/useAuth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { BtnPendingLabel } from '../components/Spinner'
import { MIN_PROFILE_NAME_LEN } from '../lib/profileComplete'
import { MOBILE_TEN_DIGIT_MSG, normalizePhoneDigits, parseToTenDigitMobile } from '../lib/phoneDigits'

export function RegisterPage() {
  const { signUp } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [mobile, setMobile] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      toast.warning('Enter your email.')
      return
    }
    if (!password || password.length < 6) {
      toast.warning('Enter a password (at least 6 characters).')
      return
    }
    const dn = displayName.trim()
    if (dn.length < MIN_PROFILE_NAME_LEN) {
      toast.warning(`Enter your name (at least ${MIN_PROFILE_NAME_LEN} characters).`)
      return
    }
    const ten = parseToTenDigitMobile(mobile)
    if (!ten) {
      toast.warning(MOBILE_TEN_DIGIT_MSG)
      return
    }
    setBusy(true)
    try {
      await signUp(email, password, dn, ten)
      nav('/')
    } catch (err) {
      toast.error(getAuthErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative mx-auto min-h-dvh max-w-[768px] overflow-hidden bg-[#f3f4f6]">
      <div className="px-5 pb-10 pt-8">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-[radial-gradient(120%_80%_at_50%_100%,rgba(229,9,20,0.13),transparent_72%)]" />
        <div className="pointer-events-none absolute -right-14 top-44 h-32 w-32 rounded-full bg-primary/10 blur-xl" />
        <div className="pointer-events-none absolute -left-14 top-56 h-28 w-28 rounded-full bg-slate-300/25 blur-xl" />

        <div className="mx-auto w-full max-w-[420px]">
          <div className="text-center">
            <img
              src="/brand/scoretrack-logo.png"
              alt="ScoreTrack"
              className="mx-auto h-auto w-full max-w-[250px] drop-shadow-sm"
            />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-dark">Create Your Account</h1>
            <p className="mt-2 text-base text-slate-600">
              Join ScoreTrack and start tracking every match, every moment.
            </p>
          </div>

          <form
            onSubmit={(e) => void onSubmit(e)}
            className="mt-8 space-y-4 rounded-xl border border-[#d6d7db] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-6"
          >
            <div className="block">
              <Label htmlFor="register-display-name" className="sr-only">
                Display name
              </Label>
              <div className="flex h-14 items-center gap-3 rounded-lg border border-[#d6d7db] bg-white px-4">
                <User className="h-[19px] w-[19px] shrink-0 text-primary" aria-hidden />
                <Input
                  id="register-display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  required
                  minLength={MIN_PROFILE_NAME_LEN}
                  disabled={busy}
                  placeholder="Enter your display name"
                  className="h-auto border-transparent bg-transparent px-0 py-0 shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:!border-0 focus-visible:!ring-0 focus-visible:outline-none aria-invalid:!border-0 aria-invalid:!ring-0 text-[1.02rem] font-medium text-slate-900 placeholder:font-normal placeholder:text-[#8b909a]"
                />
              </div>
            </div>

            <div className="block">
              <Label htmlFor="register-email" className="sr-only">
                Email
              </Label>
              <div className="flex h-14 items-center gap-3 border border-[#d6d7db] rounded-lg bg-white px-4">
                <Mail className="h-[19px] w-[19px] shrink-0 text-primary" aria-hidden />
                <Input
                  id="register-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  autoComplete="email"
                  disabled={busy}
                  placeholder="Enter your email address"
                  className="h-auto border-0 bg-transparent px-0 py-0 text-[1.02rem] font-medium text-slate-900 shadow-none ring-0 placeholder:font-normal placeholder:text-[#8b909a] focus-visible:border-0 focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="block">
              <Label htmlFor="register-password" className="sr-only">
                Password
              </Label>
              <div className="flex h-14 items-center gap-3 border border-[#d6d7db] rounded-lg bg-white px-4">
                <Lock className="h-[19px] w-[19px] shrink-0 text-primary" aria-hidden />
                <Input
                  id="register-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={busy}
                  placeholder="Enter your password"
                  className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-[1.02rem] font-medium text-slate-900 shadow-none ring-0 placeholder:font-normal placeholder:text-[#8b909a] focus-visible:border-0 focus-visible:ring-0"
                />
                <Button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 shrink-0 rounded-full p-0 text-[#9197a3] hover:bg-transparent hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={busy}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            <div className="block">
              <Label htmlFor="register-mobile" className="sr-only">
                Mobile number
              </Label>
              <div className="flex border border-[#d6d7db] rounded-lg h-14 min-w-0 items-stretch overflow-hidden rounded-xl bg-white">
                <div className="flex shrink-0 items-center gap-2 bg-slate-50 pl-4 pr-3">
                  <Smartphone className="h-[19px] w-[19px] text-primary" aria-hidden />
                  <span className="text-[1.02rem] font-semibold text-slate-900">+91</span>
                </div>
                <Input
                  id="register-mobile"
                  value={mobile}
                  onChange={(e) => setMobile(normalizePhoneDigits(e.target.value).slice(0, 10))}
                  type="tel"
                  required
                  autoComplete="tel-national"
                  inputMode="numeric"
                  disabled={busy}
                  placeholder="Enter your mobile number"
                  className="h-14 min-w-0 flex-1 rounded-none border-0 bg-transparent px-4 py-0 text-[1.02rem] font-medium text-slate-900 shadow-none ring-0 placeholder:font-normal placeholder:text-[#8b909a] focus-visible:border-0 focus-visible:ring-0"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border-0 bg-gradient-to-b from-[#ff1f2d] to-[#d1000f] px-4 text-lg font-semibold text-white shadow-[0_8px_20px_rgba(229,9,20,0.3)] transition hover:from-[#ff2b39] hover:to-[#be000d] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={busy}
            >
              <BtnPendingLabel
                pending={busy}
                idle={
                  <>
                    <span>Register</span>
                    <ArrowRight className="h-5 w-5" aria-hidden />
                  </>
                }
                busyText="Creating account…"
              />
            </Button>

            <p className="pt-1 text-center text-sm text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold !text-primary hover:!text-primary/80">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
