import type { Decorator } from '@storybook/react-vite'
import { useLayoutEffect } from 'react'
import { resetFirestoreSeed } from 'firebase/firestore'

export type FirestoreSeed = Record<string, Record<string, unknown>>

export const withFirestoreSeed: Decorator = (Story, context) => {
  const seedKey = JSON.stringify(
    (context.parameters.firestoreSeed as FirestoreSeed | undefined) ?? {},
  )

  useLayoutEffect(() => {
    const seed = JSON.parse(seedKey) as FirestoreSeed
    resetFirestoreSeed(seed)
    return () => resetFirestoreSeed({})
  }, [seedKey])

  return <Story />
}
