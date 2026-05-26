import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { getAuthErrorMessage } from '../auth/authErrors'
import { useAuth } from '../auth/useAuth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Separator } from '../components/ui/separator'
import { BtnPendingLabel } from '../components/Spinner'
import { safePostAuthPath, withRedirectQuery } from '../lib/safeRedirect'

export function LoginPage() {
  const { signIn, signInWithGoogle, sendPasswordReset } = useAuth()
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectAfterAuth = safePostAuthPath(searchParams.get('redirect'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const authBusy = googleBusy || emailBusy || resetBusy

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setEmailBusy(true)
    try {
      await signIn(email, password)
      nav(redirectAfterAuth, { replace: true })
    } catch (err) {
      toast.error(getAuthErrorMessage(err))
    } finally {
      setEmailBusy(false)
    }
  }

  async function onGoogleSignIn() {
    setGoogleBusy(true)
    try {
      const cred = await signInWithGoogle()
      if (cred) {
        nav(redirectAfterAuth, { replace: true })
      }
    } catch (err) {
      toast.error(getAuthErrorMessage(err))
    } finally {
      setGoogleBusy(false)
    }
  }

  async function onForgotPassword() {
    const emailTrimmed = email.trim()
    if (!emailTrimmed) {
      toast.warning('Enter your email first, then tap Forgot Password.')
      return
    }
    setResetBusy(true)
    try {
      await sendPasswordReset(emailTrimmed)
      toast.success('Password reset email sent. Check your inbox and spam folder.')
    } catch (err) {
      toast.error(getAuthErrorMessage(err))
    } finally {
      setResetBusy(false)
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
            <h1 className="text-2xl font-extrabold tracking-tight text-dark">Welcome Back!</h1>
            <p className="mt-2 text-base text-slate-600">
              Login to continue tracking matches and managing scores.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="mt-8 space-y-4 rounded-xl border border-[#d6d7db] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-6"
          >
            <div className="block">
              <Label htmlFor="login-email" className="sr-only">
                Email
              </Label>
              <div className="flex h-14 items-center border border-[#d6d7db] rounded-lg gap-3 rounded-xl bg-white px-4">
                <Mail className="h-[19px] w-[19px] text-primary" aria-hidden />
                <Input
                  id="login-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  autoComplete="email"
                  disabled={authBusy}
                  placeholder="Email or Phone Number"
                  className="h-auto border-0 bg-transparent px-0 py-0 text-[1.02rem] font-medium text-slate-900 shadow-none ring-0 placeholder:font-normal placeholder:text-placeholder-foreground focus-visible:border-0 focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="block">
              <Label htmlFor="login-password" className="sr-only">
                Password
              </Label>
              <div className="flex h-14 items-center gap-3 rounded-xl border border-[#d6d7db] bg-white px-4">
                <Lock className="h-[19px] w-[19px] text-primary" aria-hidden />
                <Input
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={authBusy}
                  placeholder="Password"
                  className="h-auto border-0 bg-transparent px-0 py-0 text-[1.02rem] font-medium text-slate-900 shadow-none ring-0 placeholder:font-normal placeholder:text-placeholder-foreground focus-visible:border-0 focus-visible:ring-0"
                />
                <Button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 rounded-full p-0 text-[#9197a3] hover:bg-transparent hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={authBusy}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            <div className="-mt-1 flex justify-end">
              <Button
                type="button"
                onClick={() => void onForgotPassword()}
                disabled={authBusy}
                variant="link"
                className="h-auto p-0 text-sm font-medium text-primary no-underline hover:text-primary/80 hover:no-underline disabled:opacity-60"
              >
                {resetBusy ? 'Sending reset email…' : 'Forgot Password?'}
              </Button>
            </div>

            <Button
              type="submit"
              className="mt-1 inline-flex h-12 w-full rounded-xl border-0 bg-gradient-to-b from-[#ff1f2d] to-[#d1000f] px-4 text-lg font-semibold text-white shadow-[0_8px_20px_rgba(229,9,20,0.3)] transition hover:from-[#ff2b39] hover:to-[#be000d] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={authBusy}
            >
              <BtnPendingLabel pending={emailBusy} idle="Login" busyText="Logging in…" />
            </Button>

            <div className="my-2 flex items-center gap-3">
              <Separator className="flex-1 bg-slate-300" />
              <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">or</span>
              <Separator className="flex-1 bg-slate-300" />
            </div>

            <Button
              type="button"
              onClick={() => void onGoogleSignIn()}
              disabled={authBusy}
              variant="outline"
              className="inline-flex h-12 w-full gap-3 rounded-xl border border-primary/25 bg-white px-4 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {googleBusy ? 'Connecting…' : 'Continue with Google'}
            </Button>

            <p className="pt-1 text-center text-sm text-slate-600">
              No account?{' '}
              <Link
                to={withRedirectQuery('/register', searchParams.get('redirect'))}
                className="font-semibold !text-primary hover:!text-primary/80"
              >
                Register
              </Link>
            </p>

            <p className="flex items-center justify-center gap-2 pt-1 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
              We never post on your behalf
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
