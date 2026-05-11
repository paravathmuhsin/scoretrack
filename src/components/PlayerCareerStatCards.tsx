import { cn } from '@/lib/utils'
import type { PlayerCareerStatsDoc } from '../types/models'

const DEFAULT_BPO = 6

function n(c: Partial<PlayerCareerStatsDoc> | null | undefined, key: keyof PlayerCareerStatsDoc): number {
  const v = c?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function fmt2(x: number): string {
  if (!Number.isFinite(x)) return '—'
  return x.toFixed(2)
}

function battingStrikeRate(runs: number, balls: number): string {
  if (balls <= 0) return '—'
  return fmt2((runs / balls) * 100)
}

function battingAverage(runs: number, dismissals: number): string {
  if (dismissals <= 0) return '—'
  return fmt2(runs / dismissals)
}

function bowlingEconomy(runs: number, legalBalls: number, bpo: number): string {
  if (legalBalls <= 0) return '—'
  const overs = legalBalls / bpo
  return fmt2(runs / overs)
}

function bowlingAverage(runs: number, wickets: number): string {
  if (wickets <= 0) return '—'
  return fmt2(runs / wickets)
}

function bowlingStrikeRateBallsPerWicket(balls: number, wickets: number): string {
  if (wickets <= 0) return '—'
  return fmt2(balls / wickets)
}

function bestBowlingDisplay(c: Partial<PlayerCareerStatsDoc> | null | undefined): string {
  const w = c?.bestBowlingWickets
  const r = c?.bestBowlingRunsConceded
  if (typeof w === 'number' && w > 0 && typeof r === 'number') return `${w}/${r}`
  return '—'
}

function highScoreDisplay(c: Partial<PlayerCareerStatsDoc> | null | undefined, battingInnings: number): string {
  const hs = c?.highScore
  if (typeof hs === 'number') {
    if (hs > 0) return String(hs)
    if (hs === 0 && battingInnings > 0) return '0'
  }
  return '—'
}

type Layout = 'public' | 'app'

/** Career stat blocks: app layout uses Batting, Bowling, Fielding, then Achievements; public keeps Summary + full tables. */
export function PlayerCareerStatCards({
  career,
  layout = 'public',
  className,
}: {
  career: Partial<PlayerCareerStatsDoc> | null | undefined
  layout?: Layout
  className?: string
}) {
  const mat = n(career, 'matchesPlayed')
  const inns = n(career, 'battingInnings')
  const no = n(career, 'notOuts')
  const runs = n(career, 'runs')
  const hs = highScoreDisplay(career, inns)
  const ave = battingAverage(runs, n(career, 'battingDismissals'))
  const bf = n(career, 'balls')
  const sr = battingStrikeRate(runs, bf)
  const hundreds = n(career, 'hundreds')
  const fifties = n(career, 'fifties')
  const fours = n(career, 'battingFours')
  const sixes = n(career, 'battingSixes')

  const bMat = n(career, 'bowlingMatches')
  const bInns = n(career, 'bowlingInnings')
  const bRuns = n(career, 'runsConceded')
  const wkts = n(career, 'wickets')
  const bb = bestBowlingDisplay(career)
  const bAve = bowlingAverage(bRuns, wkts)
  const legalBalls = n(career, 'bowlingBalls')
  const econ = bowlingEconomy(bRuns, legalBalls, DEFAULT_BPO)
  const bSr = bowlingStrikeRateBallsPerWicket(legalBalls, wkts)
  const fourW = n(career, 'bowlingFourWicketInnings')
  const fiveW = n(career, 'bowlingFiveWicketInnings')
  const tenW = n(career, 'bowlingTenWicketMatches')

  const catches = n(career, 'fieldingCatches')
  const stumpings = n(career, 'fieldingStumpings')
  const runOuts = n(career, 'fieldingRunOuts')

  const wrap = layout === 'public' ? 'public-live-tab-panel space-y-6' : 'space-y-4'
  const card =
    layout === 'public'
      ? 'card score-live-stats public-live-score-card'
      : 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
  const title = layout === 'public' ? 'public-live-table-title mb-2' : 'mb-2 text-sm font-semibold text-slate-900'
  const scroll = 'overflow-x-auto -mx-1 px-1'
  const table =
    layout === 'public'
      ? 'public-live-table public-live-table--career-wide min-w-[640px]'
      : 'w-full min-w-[640px] text-xs [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:border-b [&_th]:border-slate-200 [&_th]:px-1.5 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-1.5 [&_td]:py-2'
  const tdNum =
    layout === 'public' ? 'num' : 'text-right font-medium tabular-nums text-slate-900'

  const appCard =
    'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5'
  const appTitle = 'text-base font-bold leading-tight text-slate-950'
  const appTableScroll = 'mt-4 overflow-x-auto -mx-1 px-1'
  const appStatTable =
    'w-full min-w-[640px] border-collapse text-xs text-slate-900 [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:border-b [&_th]:border-slate-200 [&_th]:px-2 [&_th]:py-2 [&_th]:text-center [&_th]:font-semibold [&_th]:tabular-nums [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-2 [&_td]:py-2 [&_td]:text-center [&_td]:font-medium [&_td]:tabular-nums'

  if (layout === 'app') {
    const potm = n(career, 'potmAwards')
    const pott = n(career, 'pottAwards')
    return (
      <div className={cn('space-y-4', className)}>
        <section className={appCard}>
          <h2 className={appTitle}>Batting</h2>
          <div className={appTableScroll}>
            <table className={appStatTable}>
              <thead>
                <tr>
                  <th>Mat</th>
                  <th>Inns</th>
                  <th>NO</th>
                  <th>Runs</th>
                  <th>HS</th>
                  <th>Ave</th>
                  <th>BF</th>
                  <th>SR</th>
                  <th>100s</th>
                  <th>50s</th>
                  <th>4s</th>
                  <th>6s</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{mat}</td>
                  <td>{inns}</td>
                  <td>{no}</td>
                  <td>{runs}</td>
                  <td>{hs}</td>
                  <td>{ave}</td>
                  <td>{bf}</td>
                  <td>{sr}</td>
                  <td>{hundreds}</td>
                  <td>{fifties}</td>
                  <td>{fours}</td>
                  <td>{sixes}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className={appCard}>
          <h2 className={appTitle}>Bowling</h2>
          <div className={appTableScroll}>
            <table className={appStatTable}>
              <thead>
                <tr>
                  <th>Mat</th>
                  <th>Inns</th>
                  <th>Runs</th>
                  <th>Wkts</th>
                  <th>BB</th>
                  <th>Ave</th>
                  <th>Econ</th>
                  <th>SR</th>
                  <th>4w</th>
                  <th>5w</th>
                  <th>10w</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{bMat}</td>
                  <td>{bInns}</td>
                  <td>{bRuns}</td>
                  <td>{wkts}</td>
                  <td>{bb}</td>
                  <td>{bAve}</td>
                  <td>{econ}</td>
                  <td>{bSr}</td>
                  <td>{fourW}</td>
                  <td>{fiveW}</td>
                  <td>{tenW}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className={appCard}>
          <h2 className={appTitle}>Fielding</h2>
          <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200">
            <div className="flex flex-col items-center gap-1 px-2 py-1 text-center">
              <span className="text-[11px] font-bold text-slate-900">Catch</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">{catches}</span>
            </div>
            <div className="flex flex-col items-center gap-1 px-2 py-1 text-center">
              <span className="text-[11px] font-bold text-slate-900">Stumping</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">{stumpings}</span>
            </div>
            <div className="flex flex-col items-center gap-1 px-2 py-1 text-center">
              <span className="text-[11px] font-bold text-slate-900">Run outs</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">{runOuts}</span>
            </div>
          </div>
        </section>

        <section className={appCard}>
          <h2 className={appTitle}>Achievements</h2>
          <div className="mt-4 divide-y divide-slate-100">
            <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
              <span className="text-sm text-slate-800">Player of the Match awards</span>
              <span className="text-base font-semibold tabular-nums text-slate-900">{potm}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
              <span className="text-sm text-slate-800">Player of the Tournament awards</span>
              <span className="text-base font-semibold tabular-nums text-slate-900">{pott}</span>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={cn(wrap, className)}>
      <section className={card}>
        <h2 className={title}>Summary</h2>
        <table className="public-live-table">
          <tbody>
            <tr>
              <td>Matches (XI)</td>
              <td className={tdNum}>{mat}</td>
            </tr>
            <tr>
              <td>Player of the Match awards</td>
              <td className={tdNum}>{n(career, 'potmAwards')}</td>
            </tr>
            <tr>
              <td>Player of the Tournament awards</td>
              <td className={tdNum}>{n(career, 'pottAwards')}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={card}>
        <h2 className={title}>Batting</h2>
        <div className={scroll}>
          <table className={table}>
            <thead>
              <tr>
                <th>Mat</th>
                <th>Inns</th>
                <th>NO</th>
                <th>Runs</th>
                <th>HS</th>
                <th>Ave</th>
                <th>BF</th>
                <th>SR</th>
                <th>100s</th>
                <th>50s</th>
                <th>4s</th>
                <th>6s</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={tdNum}>{mat}</td>
                <td className={tdNum}>{inns}</td>
                <td className={tdNum}>{no}</td>
                <td className={tdNum}>{runs}</td>
                <td className={tdNum}>{hs}</td>
                <td className={tdNum}>{ave}</td>
                <td className={tdNum}>{bf}</td>
                <td className={tdNum}>{sr}</td>
                <td className={tdNum}>{hundreds}</td>
                <td className={tdNum}>{fifties}</td>
                <td className={tdNum}>{fours}</td>
                <td className={tdNum}>{sixes}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className={title}>Bowling</h2>
        <div className={scroll}>
          <table className={table}>
            <thead>
              <tr>
                <th>Mat</th>
                <th>Inns</th>
                <th>Runs</th>
                <th>Wkts</th>
                <th>BB</th>
                <th>Ave</th>
                <th>Econ</th>
                <th>SR</th>
                <th>4w</th>
                <th>5w</th>
                <th>10w</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={tdNum}>{bMat}</td>
                <td className={tdNum}>{bInns}</td>
                <td className={tdNum}>{bRuns}</td>
                <td className={tdNum}>{wkts}</td>
                <td className={tdNum}>{bb}</td>
                <td className={tdNum}>{bAve}</td>
                <td className={tdNum}>{econ}</td>
                <td className={tdNum}>{bSr}</td>
                <td className={tdNum}>{fourW}</td>
                <td className={tdNum}>{fiveW}</td>
                <td className={tdNum}>{tenW}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={card}>
        <h2 className={title}>Fielding</h2>
        <div className={scroll}>
          <table className="public-live-table min-w-[280px]">
            <thead>
              <tr>
                <th>Catch</th>
                <th>Stumping</th>
                <th>Run outs</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={tdNum}>{catches}</td>
                <td className={tdNum}>{stumpings}</td>
                <td className={tdNum}>{runOuts}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
