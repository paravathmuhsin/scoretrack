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
import {
  ANDROID_APK_FILE_NAME,
  getAndroidApkDownloadUrl,
  isAndroidApkDownloadEnabled,
} from '../lib/androidApkDownload'
import { isAndroidAppInstalled, openInAppUrl } from '../lib/openInAppUrl'

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

/** Prompts Android browser visitors to install or open the app after a short delay. */
export function AndroidAppDownloadModal() {
  const [open, setOpen] = useState(false)
  const [appInstalled, setAppInstalled] = useState(false)

  useEffect(() => {
    if (!shouldOfferAndroidApkDownload()) return

    let cancelled = false
    void isAndroidAppInstalled().then((installed) => {
      if (!cancelled) setAppInstalled(installed)
    })

    const timer = window.setTimeout(() => {
      if (!shouldOfferAndroidApkDownload()) return
      setOpen(true)
    }, SHOW_DELAY_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setOpen(false)
  }

  function openApp() {
    window.location.assign(openInAppUrl(window.location.href))
    dismiss()
  }

  const primaryButtonClassName =
    '!text-primary-foreground no-underline hover:!text-primary-foreground hover:no-underline visited:!text-primary-foreground'

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
        <AlertDialogFooter>
          <AlertDialogCancel type="button" onClick={dismiss}>
            Not now
          </AlertDialogCancel>
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
