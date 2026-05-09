import { matchCompleteHeadline, matchCompleteScoreLines } from '../lib/matchSummaryText'
import type { ReplayConfig, ReplayState } from '../scoring/engine'
import type { MatchDoc } from '../types/models'

function eventInitials(match: MatchDoc): string {
  const h = match.home.name.trim().split(/\s+/)[0]?.[0] ?? '?'
  const a = match.away.name.trim().split(/\s+/)[0]?.[0] ?? '?'
  return (h + a).toUpperCase()
}

type Props = {
  match: MatchDoc & { id: string }
  cfg: ReplayConfig
  state: ReplayState
  /** True when showing layout preview before the match is complete. */
  previewPlaceholder?: boolean
}

export function ObsMatchSummaryCard({ match, cfg, state, previewPlaceholder }: Props) {
  const headline = previewPlaceholder
    ? 'Preview — match summary'
    : matchCompleteHeadline(state, match)
  const lines = previewPlaceholder ? [] : matchCompleteScoreLines(state, cfg, match)

  return (
    <div className="obs-sc obs-match-summary-card">
      <div className="obs-sc-frame">
        <div className="obs-sc-logo" aria-hidden>
          <span className="obs-sc-logo-inner">{eventInitials(match)}</span>
        </div>

        <div className="obs-sc-inner">
          <div className="obs-sc-head-primary">MATCH RESULT</div>

          <div className="obs-sc-head-secondary obs-match-summary-head">
            <span className="obs-sc-head-meta">{headline}</span>
          </div>

          <div className="obs-match-summary-body">
            {previewPlaceholder ? (
              <p className="obs-match-summary-placeholder">
                This card appears when the match ends. Finish scoring or use Manage overlay to preview.
              </p>
            ) : (
              <ul className="obs-match-summary-lines">
                {lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
