import { doc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore'
import { ArrowLeft, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../auth/useAuth'
import { BtnPendingLabel } from '../components/Spinner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getDb } from '../firebase/config'
import { usePendingWrites } from '../hooks/usePendingWrites'
import { ensureMatchPublicId } from '../lib/ensureMatchPublicId'
import { publicAppUrl } from '../lib/publicAppUrl'
import {
  DEFAULT_OVERLAY_PREVIEW_DURATION_SEC,
  overlayPreviewDurationSec,
} from '../lib/overlayPrimary'
import type { MatchDoc, OverlayPreviewPrimary } from '../types/models'

export function MatchOverlayManagePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { run, writePending } = usePendingWrites()
  const [match, setMatch] = useState<(MatchDoc & { id: string }) | null>(null)
  const [durationInput, setDurationInput] = useState(String(DEFAULT_OVERLAY_PREVIEW_DURATION_SEC))
  const [savingDuration, setSavingDuration] = useState(false)
  const [previewBusy, setPreviewBusy] = useState<OverlayPreviewPrimary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [overlayLinkBusy, setOverlayLinkBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    const ref = doc(getDb(), 'matches', id)
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setMatch(null)
        return
      }
      const m = { id: snap.id, ...(snap.data() as MatchDoc) }
      setMatch(m)
      const d = m.overlayPrefs?.previewDurationSec
      if (typeof d === 'number' && Number.isFinite(d)) {
        setDurationInput(String(Math.floor(d)))
      } else {
        setDurationInput(String(DEFAULT_OVERLAY_PREVIEW_DURATION_SEC))
      }
    })
  }, [id])

  if (!id) return <p className="px-4 py-6">Missing match id.</p>
  if (!match) return <p className="px-4 py-6">Loading…</p>

  if (!user || match.createdBy !== user.uid) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        <Link
          to={`/app/matches/${id}/score`}
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:underline',
            '!text-primary hover:!text-primary visited:!text-primary',
          )}
        >
          <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
          Back to score
        </Link>
        <p className="mt-6 text-sm font-medium text-red-700">
          Only the match creator can manage the stream overlay.
        </p>
      </div>
    )
  }

  const publicUrl = match.publicId?.trim()
    ? publicAppUrl(`/overlay/${match.publicId}`)
    : ''

  const effectiveSec = overlayPreviewDurationSec(match)

  async function generateOverlayLink() {
    if (!match || user?.uid !== match.createdBy) return
    setOverlayLinkBusy(true)
    try {
      await ensureMatchPublicId(doc(getDb(), 'matches', match.id), match.publicId, run)
      toast.success('Overlay link created')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create overlay link')
    } finally {
      setOverlayLinkBusy(false)
    }
  }

  async function saveDuration() {
    if (!match) return
    setError(null)
    const n = Number.parseInt(durationInput, 10)
    if (!Number.isFinite(n) || n < 1 || n > 120) {
      setError('Enter a preview duration between 1 and 120 seconds.')
      return
    }
    setSavingDuration(true)
    try {
      await updateDoc(doc(getDb(), 'matches', match.id), {
        'overlayPrefs.previewDurationSec': n,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save duration.')
    } finally {
      setSavingDuration(false)
    }
  }

  async function triggerPreview(primary: OverlayPreviewPrimary) {
    if (!match) return
    setError(null)
    const sec = overlayPreviewDurationSec(match)
    setPreviewBusy(primary)
    try {
      await updateDoc(doc(getDb(), 'matches', match.id), {
        overlayPreview: {
          primary,
          until: Timestamp.fromMillis(Date.now() + sec * 1000),
        },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start preview.')
    } finally {
      setPreviewBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-12 pt-4">
      <Link
        to={`/app/matches/${id}/score`}
        className={cn(
          'inline-flex items-center gap-1.5 text-sm font-medium no-underline hover:underline',
          '!text-primary hover:!text-primary visited:!text-primary',
        )}
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        Back to score
      </Link>

      <div className="mt-6 flex items-start gap-3">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          aria-hidden
        >
          <Monitor className="size-5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900">Manage overlay</h1>
          {!match.publicId?.trim() ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-slate-600">
                Create a link to paste into OBS as a browser source (one URL per match, like a team invite link).
              </p>
              <Button
                type="button"
                className="h-11 w-full rounded-xl font-semibold"
                disabled={overlayLinkBusy || writePending}
                onClick={() => void generateOverlayLink()}
              >
                {overlayLinkBusy ? 'Creating…' : 'Generate overlay link'}
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-600">
                Your overlay settings are saved with this match. The OBS browser source uses{' '}
                <strong className="font-semibold text-slate-800">no URL parameters</strong> — keep this URL in OBS:
              </p>
              <p className="mt-2 break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-800">
                {publicUrl}
              </p>
            </>
          )}
        </div>
      </div>

      <section className="mt-8 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Preview duration</h2>
        <p className="text-sm text-slate-600">
          How long a manual preview stays on stream before returning to automatic overlays. Currently{' '}
          <strong>{effectiveSec}s</strong> when saved.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="overlay-preview-sec" className="text-xs font-semibold text-slate-700">
              Seconds (1–120)
            </label>
            <input
              id="overlay-preview-sec"
              type="number"
              min={1}
              max={120}
              className="mt-1 block h-10 w-28 rounded-lg border border-slate-200 px-3 text-sm"
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className="h-10 rounded-xl"
            disabled={savingDuration}
            onClick={() => void saveDuration()}
          >
            <BtnPendingLabel pending={savingDuration} idle="Save duration" />
          </Button>
        </div>
      </section>

      <section className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Preview on stream</h2>
        <p className="text-sm text-slate-600">
          Forces a primary overlay for the saved duration, then returns to automatic behavior based on live
          match state.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 justify-center rounded-xl"
            disabled={previewBusy != null}
            onClick={() => void triggerPreview('scoreBarOnly')}
          >
            <BtnPendingLabel pending={previewBusy === 'scoreBarOnly'} idle="Score bar only" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 justify-center rounded-xl"
            disabled={previewBusy != null}
            onClick={() => void triggerPreview('batting')}
          >
            <BtnPendingLabel pending={previewBusy === 'batting'} idle="Batting card" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 justify-center rounded-xl"
            disabled={previewBusy != null}
            onClick={() => void triggerPreview('bowling')}
          >
            <BtnPendingLabel pending={previewBusy === 'bowling'} idle="Bowling card" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 justify-center rounded-xl"
            disabled={previewBusy != null}
            onClick={() => void triggerPreview('summary')}
          >
            <BtnPendingLabel pending={previewBusy === 'summary'} idle="Match summary" />
          </Button>
        </div>
      </section>

      {error ? (
        <p className="mt-4 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
