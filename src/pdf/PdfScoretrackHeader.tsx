import { Image, StyleSheet, View } from '@react-pdf/renderer'
import { PDF_BRAND_HEADER_CENTER_SRC, PDF_BRAND_ICON_SRC } from './pdfBrandAssets'

const HEADER_SLOT = 48
const CENTER_LOGO_MAX_W = 220
const CENTER_LOGO_H = 52

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  leftSlot: {
    width: HEADER_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: HEADER_SLOT - 4,
    height: HEADER_SLOT - 4,
    objectFit: 'contain',
    objectPosition: 'center',
  },
  centerSlot: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLogo: {
    width: CENTER_LOGO_MAX_W,
    height: CENTER_LOGO_H,
    objectFit: 'contain',
    objectPosition: 'center',
  },
  rightSpacer: { width: HEADER_SLOT },
})

/** Left cricket icon + centered ScoreTrack wordmark. First page only unless `fixed` is true. */
export function PdfScoretrackHeader({ fixed = false }: { fixed?: boolean }) {
  return (
    <View style={styles.bar} fixed={fixed} wrap={false}>
      <View style={styles.leftSlot}>
        <Image src={PDF_BRAND_ICON_SRC} style={styles.icon} />
      </View>
      <View style={styles.centerSlot}>
        <Image src={PDF_BRAND_HEADER_CENTER_SRC} style={styles.centerLogo} />
      </View>
      <View style={styles.rightSpacer} />
    </View>
  )
}
