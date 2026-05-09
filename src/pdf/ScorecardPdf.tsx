import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { buildScorecardPdfModel } from '../lib/scorecardExportModel'
import type { InningsPdfSection, ScorecardPdfModel } from '../lib/scorecardExportModel'
import type { MatchDoc } from '../types/models'
import type { ReplayConfig, ReplayState, ScoreEvent } from '../scoring/engine'

/** Bumped when PDF layout changes so you can confirm the app is not serving a cached export. */
export const SCORECARD_PDF_LAYOUT_VERSION = 8

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  pdfBrandWrap: {
    marginBottom: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  pdfBrandLogo: {
    width: 168,
    height: 48,
    objectFit: 'contain',
    objectPosition: 'left',
  },
  eyebrow: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 8,
    lineHeight: 1.35,
  },
  resultLine: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 12,
    lineHeight: 1.35,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  heroTeam: { fontSize: 11, fontWeight: 'bold', flex: 1, paddingRight: 8 },
  heroRight: { alignItems: 'flex-end', maxWidth: '55%' },
  heroSub: { fontSize: 8, color: '#64748b', marginBottom: 2 },
  heroScore: { fontSize: 14, fontWeight: 'bold' },
  meta: { fontSize: 8, color: '#64748b', marginTop: 8, marginBottom: 4, lineHeight: 1.4 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#cbd5e1',
    color: '#0f172a',
  },
  innTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
    color: '#334155',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tableRowSubtotal: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  tableRowTotal: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontWeight: 'bold',
    borderBottomWidth: 1,
    borderBottomColor: '#94a3b8',
  },
  colBatCell: { width: '46%', paddingRight: 4 },
  colNumSm: { width: '10.8%', textAlign: 'right', fontSize: 8 },
  colBowlingName: { width: '40%', paddingRight: 4 },
  fowBlock: { marginTop: 8, marginBottom: 6 },
  fowTitle: { fontSize: 8, fontWeight: 'bold', marginBottom: 3, color: '#475569' },
  fowBody: { fontSize: 8, color: '#334155', lineHeight: 1.45 },
  yetBlock: { marginTop: 6, marginBottom: 4 },
  yetTitle: { fontSize: 8, fontWeight: 'bold', marginBottom: 3, color: '#475569' },
  yetBody: { fontSize: 8, color: '#64748b', lineHeight: 1.4 },
  mvpPotm: {
    marginTop: 6,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 2,
  },
  mvpPotmLabel: { fontSize: 8, color: '#64748b', marginBottom: 4 },
  mvpPotmName: { fontSize: 12, fontWeight: 'bold' },
  mvpPotmTeam: { fontSize: 8, color: '#64748b', marginTop: 2 },
  mvpPotmNote: { fontSize: 7, color: '#64748b', marginTop: 6, lineHeight: 1.35 },
  mvpHint: { fontSize: 8, color: '#64748b', fontStyle: 'italic', marginBottom: 8 },
  muted: { fontSize: 8, color: '#64748b' },
  potmRow: { backgroundColor: '#eff6ff' },
  pdfFooter: {
    fontSize: 7,
    color: '#94a3b8',
    marginTop: 14,
    textAlign: 'center',
  },
})

function pdfLogoAbsoluteUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL('/brand/scoretrack-logo.png', window.location.origin).href
  }
  return '/brand/scoretrack-logo.png'
}

function PdfBrandHeader() {
  return (
    <View style={styles.pdfBrandWrap} wrap={false}>
      <Image src={pdfLogoAbsoluteUrl()} style={styles.pdfBrandLogo} />
    </View>
  )
}

function PdfHero({ model }: { model: ScorecardPdfModel }) {
  return (
    <View>
      <Text style={styles.eyebrow}>{model.eyebrow}</Text>
      {model.resultLine ? <Text style={styles.resultLine}>{model.resultLine}</Text> : null}
      {model.resultEndReasonLine ? <Text style={styles.meta}>{model.resultEndReasonLine}</Text> : null}
      {model.heroRows.map((row, i) => (
        <View key={i} style={styles.heroRow} wrap={false}>
          <Text style={styles.heroTeam}>{row.team}</Text>
          <View style={styles.heroRight}>
            {row.sub ? <Text style={styles.heroSub}>{row.sub}</Text> : null}
            <Text style={styles.heroScore}>{row.score}</Text>
          </View>
        </View>
      ))}
      {model.tossLine ? <Text style={styles.meta}>{model.tossLine}</Text> : null}
    </View>
  )
}

function PdfBattingTable({ inn }: { inn: InningsPdfSection }) {
  return (
    <View wrap={false}>
      <View style={styles.tableHead}>
        <Text style={[styles.colBatCell, { fontWeight: 'bold' }]}>Batting</Text>
        <Text style={[styles.colNumSm, { fontWeight: 'bold' }]}>R</Text>
        <Text style={[styles.colNumSm, { fontWeight: 'bold' }]}>B</Text>
        <Text style={[styles.colNumSm, { fontWeight: 'bold' }]}>4s</Text>
        <Text style={[styles.colNumSm, { fontWeight: 'bold' }]}>6s</Text>
        <Text style={[styles.colNumSm, { fontWeight: 'bold' }]}>S/R</Text>
      </View>
      {inn.battingRows.map((r, idx) => (
        <View key={idx} style={styles.tableRow}>
          <View style={styles.colBatCell}>
            <Text style={{ fontSize: 9 }}>
              {r.name}
              {r.notOutStar ? '*' : ''}
            </Text>
            <Text style={{ fontSize: 7, color: '#64748b', marginTop: 1, lineHeight: 1.35 }}>
              {r.status}
            </Text>
          </View>
          <Text style={styles.colNumSm}>{r.runs}</Text>
          <Text style={styles.colNumSm}>{r.balls}</Text>
          <Text style={styles.colNumSm}>{r.fours}</Text>
          <Text style={styles.colNumSm}>{r.sixes}</Text>
          <Text style={styles.colNumSm}>{r.sr}</Text>
        </View>
      ))}
      <View style={styles.tableRowSubtotal}>
        <Text style={{ width: '46%' }}>Extras</Text>
        <Text style={styles.colNumSm}>{inn.extras}</Text>
        <Text style={{ width: '43.2%' }} />
      </View>
      <View style={styles.tableRowTotal}>
        <Text style={{ width: '46%', fontWeight: 'bold' }}>Total</Text>
        <Text style={[styles.colNumSm, { fontWeight: 'bold' }]}>
          {inn.totalRuns}/{inn.totalWickets}
        </Text>
        <Text style={{ width: '43.2%', fontSize: 7, color: '#64748b', paddingLeft: 4 }}>
          {inn.oversStr} ov (RR: {inn.rr})
        </Text>
      </View>
    </View>
  )
}

function PdfBowlingTable({ inn }: { inn: InningsPdfSection }) {
  return (
    <View style={{ marginTop: 8 }} wrap={false}>
      <Text style={styles.fowTitle}>Bowling ({inn.bowlingTeamName})</Text>
      <View style={styles.tableHead}>
        <Text style={[styles.colBowlingName, { fontWeight: 'bold' }]}>Bowling</Text>
        <Text style={[styles.colNumSm, { fontWeight: 'bold' }]}>O</Text>
        <Text style={[styles.colNumSm, { fontWeight: 'bold' }]}>M</Text>
        <Text style={[styles.colNumSm, { fontWeight: 'bold' }]}>R</Text>
        <Text style={[styles.colNumSm, { fontWeight: 'bold' }]}>W</Text>
        <Text style={[styles.colNumSm, { fontWeight: 'bold' }]}>Econ</Text>
      </View>
      {inn.bowlingRows.map((r, idx) => (
        <View key={idx} style={styles.tableRow}>
          <Text style={styles.colBowlingName}>{r.name}</Text>
          <Text style={styles.colNumSm}>{r.overs}</Text>
          <Text style={styles.colNumSm}>{r.maidens}</Text>
          <Text style={styles.colNumSm}>{r.runs}</Text>
          <Text style={styles.colNumSm}>{r.wickets}</Text>
          <Text style={styles.colNumSm}>{r.econ}</Text>
        </View>
      ))}
    </View>
  )
}

function PdfInningsBlock({ inn }: { inn: InningsPdfSection }) {
  return (
    <View minPresenceAhead={120}>
      <Text style={styles.innTitle}>
        Innings {inn.innings} — {inn.battingTeamName}
      </Text>
      <Text style={styles.muted} wrap={false}>
        Batting ({inn.battingTeamName})
      </Text>
      <PdfBattingTable inn={inn} />
      {inn.fallOfWickets ? (
        <View style={styles.fowBlock}>
          <Text style={styles.fowTitle}>Fall of wickets ({inn.battingTeamName})</Text>
          <Text style={styles.fowBody}>{inn.fallOfWickets}</Text>
        </View>
      ) : null}
      {inn.yetToBat ? (
        <View style={styles.yetBlock}>
          <Text style={styles.yetTitle}>Yet to bat</Text>
          <Text style={styles.yetBody}>{inn.yetToBat.join(' · ')}</Text>
        </View>
      ) : null}
      <PdfBowlingTable inn={inn} />
    </View>
  )
}

function PdfMvp({ model }: { model: ScorecardPdfModel }) {
  const { mvp } = model
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.sectionTitle}>Most Valuable Player (MVP)</Text>
      {mvp.potm ? (
        <View style={styles.mvpPotm}>
          <Text style={styles.mvpPotmLabel}>Player of the Match</Text>
          <Text style={styles.mvpPotmName}>{mvp.potm.name}</Text>
          <Text style={styles.mvpPotmTeam}>
            {mvp.potm.side === 'home' ? model.homeName : model.awayName}
          </Text>
          {mvp.potmNote ? <Text style={styles.mvpPotmNote}>{mvp.potmNote}</Text> : null}
        </View>
      ) : (
        <Text style={styles.mvpHint}>
          Live match — standings update with each ball. Player of the Match is awarded when the match finishes.
        </Text>
      )}
      {mvp.rows.length === 0 ? (
        <Text style={styles.muted}>No squad line-ups on file; MVP cannot be computed.</Text>
      ) : (
        <View wrap={false}>
          <View style={styles.tableHead}>
            <Text style={{ width: '44%', fontWeight: 'bold' }}>Player</Text>
            <Text style={[styles.colNumSm, { fontWeight: 'bold', width: '14%' }]}>Bat</Text>
            <Text style={[styles.colNumSm, { fontWeight: 'bold', width: '14%' }]}>Bowl</Text>
            <Text style={[styles.colNumSm, { fontWeight: 'bold', width: '14%' }]}>Fld</Text>
            <Text style={[styles.colNumSm, { fontWeight: 'bold', width: '14%' }]}>Total</Text>
          </View>
          {mvp.rows.map((r) => {
            const isPotm = mvp.potm?.playerId === r.playerId
            return (
              <View
                key={r.playerId}
                style={[styles.tableRow, isPotm ? styles.potmRow : {}]}
              >
                <Text style={{ width: '44%' }}>
                  {r.name}{' '}
                  <Text style={styles.muted}>
                    ({r.side === 'home' ? model.homeName : model.awayName})
                  </Text>
                </Text>
                <Text style={[styles.colNumSm, { width: '14%' }]}>{r.batting.toFixed(2)}</Text>
                <Text style={[styles.colNumSm, { width: '14%' }]}>{r.bowling.toFixed(2)}</Text>
                <Text style={[styles.colNumSm, { width: '14%' }]}>{r.fielding.toFixed(2)}</Text>
                <Text style={[styles.colNumSm, { width: '14%', fontWeight: 'bold' }]}>
                  {r.total.toFixed(2)}
                </Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

export function ScorecardPdfDocument({
  match,
  state,
  cfg,
  events,
}: {
  match: MatchDoc & { id: string }
  state: ReplayState
  cfg: ReplayConfig
  events: ScoreEvent[]
}) {
  const model = buildScorecardPdfModel(match, cfg, state, events)

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <PdfBrandHeader />
        <PdfHero model={model} />
        <Text style={styles.sectionTitle}>Scorecard</Text>
        {model.innings.map((inn) => (
          <PdfInningsBlock key={inn.innings} inn={inn} />
        ))}
        <PdfMvp model={model} />
        <Text
          style={styles.pdfFooter}
          fixed
          render={({ pageNumber, totalPages }) =>
            `ScoreTrack · full scorecard export · v${SCORECARD_PDF_LAYOUT_VERSION} · page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  )
}
