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
import { ANDROID_APK_FILE_NAME, ANDROID_APK_PATH } from '../lib/androidApkDownload'

const DISMISS_KEY = 'st-android-apk-modal-dismissed'
const SHOW_DELAY_MS = 3000

function shouldOfferAndroidApkDownload(): boolean {
  if (Capacitor.isNativePlatform()) return false
  if (typeof window === 'undefined') return false
  if (sessionStorage.getItem(DISMISS_KEY) === '1') return false
  if (!/Android/i.test(navigator.userAgent)) return false
  if (window.location.pathname.startsWith('/overlay/')) return false
  return true
}

/** Prompts Android browser visitors to install the app after a short delay. */
export function AndroidAppDownloadModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!shouldOfferAndroidApkDownload()) return

    const timer = window.setTimeout(() => {
      if (!shouldOfferAndroidApkDownload()) return
      setOpen(true)
    }, SHOW_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [])

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setOpen(false)
  }

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
          <AlertDialogTitle>Get the ScoreTrack app</AlertDialogTitle>
          <AlertDialogDescription>
            Install the Android app for faster access, live scoring, and a better experience than
            the browser.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" onClick={dismiss}>
            Not now
          </AlertDialogCancel>
          <Button
            type="button"
            className="!text-primary-foreground no-underline hover:!text-primary-foreground hover:no-underline visited:!text-primary-foreground"
            render={
              <a
                href={ANDROID_APK_PATH}
                download={ANDROID_APK_FILE_NAME}
                onClick={dismiss}
              />
            }
          >
            Download app
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
