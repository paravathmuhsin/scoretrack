import { createContext } from 'react'
import type { User } from 'firebase/auth'

export type AuthContextValue = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  signInWithGoogle: () => Promise<import('firebase/auth').UserCredential | null | void>
  signUp: (
    email: string,
    password: string,
    fullName: string,
    displayName: string,
    mobile: string,
  ) => Promise<void>
  /** Update Firestore profile + public directory (name, mobile for search). */
  updateProfileContact: (patch: { fullName?: string; displayName?: string; mobile?: string }) => Promise<void>
  /** Writes current `users/{uid}` names onto `playerCareerStats` so `/player/:uid` works when logged out. */
  syncCareerProfileMirror: () => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
