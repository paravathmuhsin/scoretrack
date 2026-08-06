import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.scoretrackonline.app',
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
      /** Custom Auth domain (must also be in Firebase Auth → Authorized domains). */
      authDomain: 'scoretrackonline.com',
      /**
       * App uses Firebase JS SDK (Firestore + Auth). Native Google Sign-In only
       * obtains a credential; JS `signInWithCredential` creates the real session.
       */
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
}

export default config
