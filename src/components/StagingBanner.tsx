export function StagingBanner() {
  if (import.meta.env.MODE !== 'staging') return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] bg-amber-500 px-4 py-1.5 text-center text-sm font-medium text-amber-950"
    >
      Staging environment — data here is not production
    </div>
  )
}
