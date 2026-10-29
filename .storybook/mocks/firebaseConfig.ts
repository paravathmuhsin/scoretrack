import type { Firestore } from './firestore'

/** Storybook stub — real app uses src/firebase/config.ts */
export function getFirebaseApp(): { name: string } {
  return { name: 'storybook-mock' }
}

export function getFirebaseAuth(): { currentUser: null } {
  return { currentUser: null }
}

export function getDb(): Firestore {
  return {}
}
