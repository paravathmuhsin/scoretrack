import { Check, X } from 'lucide-react'
import { playerInitials } from '@/lib/playingSquadTiles'
import { cn } from '@/lib/utils'

const tileShellSelected =
  'relative flex w-full flex-col items-center gap-2 rounded-xl border px-2 pb-2.5 pt-3 text-center border-primary/50 bg-primary/[0.08] shadow-sm ring-1 ring-primary/20'

/** Toggle tile for picking squad in the modal (tap to select/deselect). */
export function SquadPickTile({
  selected,
  name,
  onToggle,
}: {
  selected: boolean
  name: string
  onToggle: () => void
}) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={selected ? `Deselect ${name}` : `Select ${name}`}
        className={cn(
          'relative flex w-full flex-col items-center gap-2 rounded-xl border px-2 pb-2.5 pt-3 text-center transition-all outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          selected
            ? tileShellSelected
            : 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-slate-50',
        )}
        onClick={onToggle}
      >
        {selected && (
          <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
        )}
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tracking-tight',
            selected ? 'bg-primary text-primary-foreground' : 'bg-slate-200/90 text-slate-700',
          )}
          aria-hidden
        >
          {playerInitials(name)}
        </span>
        <span className="line-clamp-2 min-h-[2.25rem] w-full px-0.5 text-[13px] font-medium leading-snug text-slate-900">
          {name}
        </span>
      </button>
    </li>
  )
}

/** Start-match squad chip: name + remove. */
export function SquadSummaryTile({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <li className="w-fit max-w-full">
      <div className="flex w-fit max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
        <span className="max-w-[min(100%,18rem)] text-[14px] font-medium leading-snug text-slate-900 line-clamp-2 break-words">
          {name}
        </span>
        <button
          type="button"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          aria-label={`Remove ${name} from squad`}
          onClick={(e) => {
            e.preventDefault()
            onRemove()
          }}
        >
          <X className="size-4" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </li>
  )
}

