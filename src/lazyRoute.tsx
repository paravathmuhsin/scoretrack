import { Suspense, lazy, type ComponentType, type ReactNode } from 'react'
import { Spinner } from './components/Spinner'

export function lazyPage<M extends Record<string, ComponentType<object>>>(
  factory: () => Promise<M>,
  exportName: keyof M & string,
) {
  return lazy(() => factory().then((module) => ({ default: module[exportName] })))
}

function RoutePageFallback() {
  return (
    <div className="flex min-h-[12rem] items-center justify-center py-12">
      <Spinner label="Loading…" />
    </div>
  )
}

export function RoutePage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RoutePageFallback />}>{children}</Suspense>
}
