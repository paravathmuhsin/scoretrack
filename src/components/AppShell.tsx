import { Outlet } from 'react-router-dom'
import { MobileHeader, PublicMobileFooter } from './MobileChrome'

export function AppShell() {
  return (
    <div className="shell mx-auto min-h-dvh max-w-[768px] bg-[#f3f4f6]">
      <MobileHeader />
      <main className="main !max-w-none !px-3 !pt-4 !pb-[calc(80px+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <PublicMobileFooter />
    </div>
  )
}
