/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Play listing URL. Empty string hides the Android install prompt. */
  readonly VITE_ANDROID_PLAY_STORE_URL?: string
  /** @deprecated Use VITE_ANDROID_PLAY_STORE_URL. Empty string still hides the prompt. */
  readonly VITE_ANDROID_APK_URL?: string
  readonly VITE_PUBLIC_APP_URL?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
