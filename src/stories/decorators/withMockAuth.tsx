import type { Decorator } from '@storybook/react-vite'
import type { User } from 'firebase/auth'
import { AuthContext, type AuthContextValue } from '@/auth/context'

const noopAsync = async () => {}

function mockUser(partial: Partial<User> = {}): User {
  return {
    uid: 'storybook-user',
    email: 'demo@scoretrack.app',
    displayName: 'Demo Player',
    ...partial,
  } as User
}

const signedOut: AuthContextValue = {
  user: null,
  loading: false,
  signIn: noopAsync,
  sendPasswordReset: noopAsync,
  signInWithGoogle: noopAsync,
  signUp: noopAsync,
  updateProfileContact: noopAsync,
  syncCareerProfileMirror: noopAsync,
  logout: noopAsync,
  deleteAccount: noopAsync,
}

const signedIn: AuthContextValue = {
  ...signedOut,
  user: mockUser(),
}

const loading: AuthContextValue = {
  ...signedOut,
  loading: true,
}

const presets = { signedIn, signedOut, loading } as const

export type MockAuthPreset = keyof typeof presets

export const withMockAuth: Decorator = (Story, context) => {
  const preset = (context.parameters.auth?.preset as MockAuthPreset | undefined) ?? 'signedIn'
  const value = presets[preset] ?? signedIn
  return (
    <AuthContext.Provider value={value}>
      <Story />
    </AuthContext.Provider>
  )
}
