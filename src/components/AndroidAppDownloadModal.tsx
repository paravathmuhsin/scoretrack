import { Capacitor } from '@capacitor/core'
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
  ANDROID_APK_FILE_NAME,
  getAndroidApkDownloadUrl,
  isAndroidApkDownloadEnabled,
} from '../lib/androidApkDownload'
import { launchAndroidApp, resolveAndroidAppInstalled } from '../lib/openInAppUrl'

const DISMISS_KEY = 'st-android-apk-modal-dismissed'
const SHOW_DELAY_MS = 3000

function shouldOfferAndroidApkDownload(): boolean {
  if (!isAndroidApkDownloadEnabled()) return false
  if (Capacitor.isNativePlatform()) return false
  if (typeof window === 'undefined') return false
  if (sessionStorage.getItem(DISMISS_KEY) === '1') return false
  if (!/Android/i.test(navigator.userAgent)) return false
  if (window.location.pathname.startsWith('/overlay/')) return false
  return true
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/** Prompts Android browser visitors to install or open the app after a short delay. */
export function AndroidAppDownloadModal() {
  const [open, setOpen] = useState(false)
  const [appInstalled, setAppInstalled] = useState(false)

  useEffect(() => {
    if (!shouldOfferAndroidApkDownload()) return

    let cancelled = false

    void (async () => {
      const [, installed] = await Promise.all([delay(SHOW_DELAY_MS), resolveAndroidAppInstalled()])
      if (cancelled || !shouldOfferAndroidApkDownload()) return
      setAppInstalled(installed)
      setOpen(true)
    })()

    const refreshInstalled = () => {
      if (document.visibilityState !== 'visible') return
      void resolveAndroidAppInstalled().then((installed) => {
        if (!cancelled) setAppInstalled(installed)
      })
    }

    document.addEventListener('visibilitychange', refreshInstalled)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', refreshInstalled)
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
          <AlertDialogTitle>
            {appInstalled ? 'Open ScoreTrack app' : 'Get the ScoreTrack app'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {appInstalled
              ? 'ScoreTrack is installed on your device. Open the app for faster access and live scoring.'
              : 'Install the Android app for faster access, live scoring, and a better experience than the browser.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="!flex-col gap-2 sm:!flex-col sm:!justify-stretch">
          {appInstalled ? (
            <Button type="button" className={primaryButtonClassName} onClick={openApp}>
              Open app
            </Button>
          ) : (
            <Button
              type="button"
              className={primaryButtonClassName}
              render={
                <a
                  href={getAndroidApkDownloadUrl()}
                  download={ANDROID_APK_FILE_NAME}
                  onClick={dismiss}
                />
              }
            >
              Download app
            </Button>
          )}
          <AlertDialogCancel type="button" className={actionButtonClassName} onClick={dismiss}>
            Not now
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
