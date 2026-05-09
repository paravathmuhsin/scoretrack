import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { StandingsDoc } from '../types/models'

/** Mirrors `src/index.css` `.table` / `.table th, .table td` on the points panel. */
const TEXT = '#0f172a'
const BORDER = '#e2e8f0'

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: TEXT,
    backgroundColor: '#ffffff',
  },
  tournamentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: TEXT,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 0,
    color: TEXT,
  },
  table: {
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 0,
  },
  /** Same columns as `TournamentPointsPanel` thead/tbody */
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 4,
    minHeight: 22,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 4,
    minHeight: 22,
  },
  th: {
    fontSize: 11,
    fontWeight: 'bold',
    color: TEXT,
  },
  td: {
    fontSize: 11,
    color: TEXT,
  },
  colTeam: { width: '34%', paddingRight: 6 },
  colP: { width: '11%' },
  colW: { width: '11%' },
  colL: { width: '11%' },
  colNr: { width: '11%' },
  colPts: { width: '11%' },
  colNrr: { width: '11%' },
})

export function StatsPdfDocument({
  tournamentName,
  standings,
}: {
  tournamentName: string
  standings: StandingsDoc | null
}) {
  const teams = standings?.teams ?? []

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.tournamentTitle}>{tournamentName}</Text>
        <Text style={styles.sectionTitle}>Points table</Text>

        <View style={styles.table}>
          <View style={styles.headerRow} fixed>
            <View style={styles.colTeam}>
              <Text style={styles.th}>Team</Text>
            </View>
            <View style={styles.colP}>
              <Text style={styles.th}>P</Text>
            </View>
            <View style={styles.colW}>
              <Text style={styles.th}>W</Text>
            </View>
            <View style={styles.colL}>
              <Text style={styles.th}>L</Text>
            </View>
            <View style={styles.colNr}>
              <Text style={styles.th}>NR</Text>
            </View>
            <View style={styles.colPts}>
              <Text style={styles.th}>Pts</Text>
            </View>
            <View style={styles.colNrr}>
              <Text style={styles.th}>NRR</Text>
            </View>
          </View>

          {teams.map((r) => (
            <View key={r.teamId} style={styles.row} wrap={false}>
              <View style={styles.colTeam}>
                <Text style={styles.td}>{r.teamName}</Text>
              </View>
              <View style={styles.colP}>
                <Text style={styles.td}>{r.played}</Text>
              </View>
              <View style={styles.colW}>
                <Text style={styles.td}>{r.won}</Text>
              </View>
              <View style={styles.colL}>
                <Text style={styles.td}>{r.lost}</Text>
              </View>
              <View style={styles.colNr}>
                <Text style={styles.td}>{r.nr ?? 0}</Text>
              </View>
              <View style={styles.colPts}>
                <Text style={styles.td}>{r.points}</Text>
              </View>
              <View style={styles.colNrr}>
                <Text style={styles.td}>{r.nrr}</Text>
              </View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
