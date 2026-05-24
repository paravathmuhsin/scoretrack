import { Capacitor } from '@capacitor/core'
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

function readEnv(key: string): string {
  const v = import.meta.env[key as keyof ImportMetaEnv] as string | undefined
  return v ?? ''
}

export function getFirebaseApp(): FirebaseApp {
  if (app) return app
  const config = {
    apiKey: readEnv('VITE_FIREBASE_API_KEY'),
    authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readEnv('VITE_FIREBASE_APP_ID'),
  }
  if (!config.apiKey || !config.projectId) {
    console.warn('Firebase env missing: set VITE_FIREBASE_* in .env for full functionality.')
  }
  app = initializeApp(config)
  return app
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth
  const app = getFirebaseApp()
  if (Capacitor.isNativePlatform()) {
    auth = initializeAuth(app, {
      persistence: indexedDBLocalPersistence,
    })
  } else {
    auth = getAuth(app)
  }
  return auth
}

export function getDb(): Firestore {
  if (db) return db
  db = getFirestore(getFirebaseApp())
  return db
}
