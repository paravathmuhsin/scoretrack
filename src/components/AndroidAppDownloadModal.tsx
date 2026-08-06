import { Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getAndroidPlayStoreUrl,
  isAndroidPlayStorePromptEnabled,
  isAndroidWebBrowser,
} from '../lib/androidApkDownload'
import { launchAndroidApp, markAndroidApkDownloadPending } from '../lib/openInAppUrl'

const DISMISS_KEY = 'st-android-play-modal-dismissed'
const SHOW_DELAY_MS = 3000

function shouldOfferAndroidPlayStore(): boolean {
  // Hard gate: Android browser only — never iOS, desktop, or native app.
  if (!isAndroidWebBrowser()) return false
  if (!isAndroidPlayStorePromptEnabled()) return false
  if (typeof window === 'undefined') return false
  if (sessionStorage.getItem(DISMISS_KEY) === '1') return false
  if (window.location.pathname.startsWith('/overlay/')) return false
  return true
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/** Prompts Android browser visitors to install from Google Play after a short delay. */
export function AndroidAppDownloadModal() {
  const [eligible, setEligible] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!shouldOfferAndroidPlayStore()) {
      setEligible(false)
      return
    }

    setEligible(true)
    let cancelled = false

    void (async () => {
      await delay(SHOW_DELAY_MS)
      if (cancelled || !shouldOfferAndroidPlayStore()) return
      setOpen(true)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setOpen(false)
  }

  function openApp() {
    launchAndroidApp(window.location.href)
    dismiss()
  }

  if (!eligible) return null

  const actionButtonClassName =
    'min-h-[50px] h-12 w-full rounded-xl text-base font-semibold'
  const primaryButtonClassName = cn(
    actionButtonClassName,
    '!text-primary-foreground no-underline hover:!text-primary-foreground hover:no-underline visited:!text-primary-foreground',
  )

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <AlertDialogContent size="default" className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/10 text-primary">
            <Smartphone className="size-5" aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>Get ScoreTrack on Google Play</AlertDialogTitle>
          <AlertDialogDescription>
            Available for Android phones only. Install from Google Play for faster access, live
            scoring, and a better experience than the browser.
          </AlertDialogDescription>
          <button
            type="button"
            className="mt-1 text-left text-sm font-medium text-primary hover:underline"
            onClick={openApp}
          >
            Already installed? Open Android app
          </button>
        </AlertDialogHeader>
        <AlertDialogFooter className="!flex-col gap-2 sm:!flex-col sm:!justify-stretch">
          <Button
            type="button"
            className={primaryButtonClassName}
            render={
              <a
                href={getAndroidPlayStoreUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => markAndroidApkDownloadPending()}
              />
            }
          >
            Download now
          </Button>
          <AlertDialogCancel type="button" className={actionButtonClassName} onClick={dismiss}>
            Not now
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
