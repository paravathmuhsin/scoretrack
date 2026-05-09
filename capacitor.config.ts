import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.scoretrack.app',
  appName: 'ScoreTrack',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
