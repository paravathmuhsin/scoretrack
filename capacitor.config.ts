import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.scoretrack.app',
  appName: 'ScoreTrack',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    /** WebView origin; must match Android App Links + Firebase Auth redirect host. */
    hostname: 'scoretrackonline.com',
    iosScheme: 'capacitor',
  },
  plugins: {
    FirebaseAuthentication: {
      authDomain: 'scoretrackonline.com',
      providers: ['google.com'],
    },
  },
}

export default config
