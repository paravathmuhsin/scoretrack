import { useCallback, useState } from 'react'

/** Tracks overlapping async writes; increment on start, decrement in finally. */
export function usePendingWrites() {
  const [n, setN] = useState(0)
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setN((x) => x + 1)
    try {
      return await fn()
    } finally {
      setN((x) => Math.max(0, x - 1))
    }
  }, [])
  return { writePending: n > 0, run }
}
