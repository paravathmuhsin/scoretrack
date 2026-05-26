import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { canSearchDirectory, searchDirectoryUsers, type DirectoryHit } from '../lib/directorySearch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Props = {
  teamName: string
  currentUserUid: string
  busy: boolean
  onClose: () => void
  onConfirm: (hit: DirectoryHit) => void
}

export function TransferOwnershipDialogContent({
  teamName,
  currentUserUid,
  busy,
  onClose,
  onConfirm,
}: Props) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(false)
  const [hits, setHits] = useState<DirectoryHit[]>([])
  const [selected, setSelected] = useState<DirectoryHit | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 300)
    return () => window.clearTimeout(t)
  }, [q])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setError(null)
      if (!canSearchDirectory(debounced)) {
        setHits([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const list = await searchDirectoryUsers(debounced, 10)
        if (!cancelled) {
          setHits(list.filter((h) => h.uid !== currentUserUid))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [debounced, currentUserUid])

  const confirmLabel = useMemo(() => {
    if (!selected) return 'Select a player'
    return `Send request to ${selected.displayName}`
  }, [selected])

  const handleConfirm = useCallback(() => {
    if (!selected) return
    onConfirm(selected)
  }, [selected, onConfirm])

  return (
    <div className="flex max-h-[min(90dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl">
      <div className="relative border-b border-slate-100 px-5 pb-4 pt-5">
        <button
          type="button"
          className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="size-4" strokeWidth={2.2} />
        </button>
        <h2 className="pr-10 text-lg font-bold text-slate-900">Transfer ownership</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose who should own <span className="font-semibold text-slate-700">{teamName}</span>. They must accept in
          Notifications.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div
          className={cn(
            'flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 shadow-sm transition-shadow',
            'focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15',
          )}
        >
          <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSelected(null)
            }}
            placeholder="Search players by name or phone"
            aria-label="Search players"
            autoComplete="off"
            autoFocus
            className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-slate-900 shadow-none placeholder:text-placeholder-foreground focus-visible:ring-0 md:text-sm"
          />
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <ul className="mt-3 space-y-1">
          {loading && <li className="py-4 text-center text-sm text-slate-500">Searching…</li>}
          {!loading && canSearchDirectory(debounced) && hits.length === 0 && (
            <li className="py-4 text-center text-sm text-slate-500">No players found.</li>
          )}
          {hits.map((h) => (
            <li key={h.uid}>
              <button
                type="button"
                className={cn(
                  'flex w-full min-w-0 items-center rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                  selected?.uid === h.uid
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-900 hover:bg-slate-50',
                )}
                aria-label={h.email ? `${h.displayName}, ${h.email}` : h.displayName}
                onClick={() => setSelected(h)}
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{h.displayName}</span>
                  {h.email ? (
                    <span
                      className={cn(
                        'font-normal',
                        selected?.uid === h.uid ? 'text-primary/85' : 'text-slate-500',
                      )}
                    >
                      {' '}
                      ({h.email})
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-slate-100 px-5 py-4">
        <Button
          type="button"
          className="h-11 w-full rounded-xl font-semibold"
          disabled={!selected || busy}
          onClick={handleConfirm}
        >
          {busy ? 'Sending…' : confirmLabel}
        </Button>
      </div>
    </div>
  )
}
