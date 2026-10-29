# ScoreTrack

Live cricket score tracking — React + TypeScript + Vite, Firebase, and Capacitor (iOS/Android).

## Staging environment

Staging is a **separate Firebase project** with its own Auth and Firestore data, deployed to the default Firebase Hosting URL (`https://scoretrack-staging.web.app`). Use it to validate changes before deploying to production (`scoretrackonline.com`).

**Mobile builds (Capacitor) still use production Firebase** — staging is for web testing only.

### One-time Firebase Console setup

1. Open [scoretrack-staging → Authentication](https://console.firebase.google.com/project/scoretrack-staging/authentication).
2. Click **Get started** (required — without this you get `auth/configuration-not-found`).
3. **Sign-in method** tab → enable:
   - **Email/Password**
   - **Google** (pick a support email when prompted)
4. Create a **Firestore** database if not done yet (`npm run firebase:deploy:staging:rules` deploys rules).
5. Register a **Web app** and copy config into `.env.staging` (see `.env.staging.example`).
6. **Authentication → Settings → Authorized domains** — ensure these exist:
   - `localhost`
   - `scoretrack-staging.web.app`
   - `scoretrack-staging.firebaseapp.com`
7. If Google sign-in fails on localhost or staging URL, in [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=scoretrack-staging) add OAuth **Authorized JavaScript origins**:
   - `http://localhost:5173`
   - `https://scoretrack-staging.web.app`

### Local staging config

```bash
cp .env.staging.example .env.staging
# Fill in VITE_FIREBASE_* from the staging web app config in Firebase Console
```

### Bulk test users (staging / test Firebase only)

**Not for production.** Script only runs when `.env.staging` targets **`scoretrack-staging`** and you pass `--confirm-staging` (included in the yarn script below).

After Email/Password Auth is enabled on **scoretrack-staging**:

```bash
yarn seed:staging:test-users -- --count 100 --password 'TestPass123!'
```

Creates `test1@example.com` … with display names `Test 1`, …, plus `users/{uid}` and `directoryUsers/{uid}` for directory search. Re-runs skip existing emails.

### Deploy commands

| Command | Target |
|---------|--------|
| `npm run firebase:deploy:staging:rules` | Firestore rules + indexes → staging |
| `npm run firebase:deploy:staging:hosting` | Web app → `scoretrack-staging.web.app` |
| `npm run firebase:deploy:staging` | Rules + hosting + anything else in `firebase.json` |
| `npm run firebase:deploy` | Production (unchanged) → `scoretrackonline.com` |

First deploy: run rules, then hosting:

```bash
npm run firebase:deploy:staging:rules
npm run firebase:deploy:staging:hosting
```

Run the app locally against the staging backend:

```bash
npm run dev:staging
```

A yellow **Staging environment** banner appears when built with `--mode staging`.

---

## Android Firebase setup

After cloning or on a new machine, configure Firebase for the Android app:

```bash
npm run cap:android:firebase   # downloads google-services.json
npm run cap:android:sha        # prints SHA-1 to add in Firebase if needed
```

Then rebuild: `npm run cap:build:android`

---

## Google Play deployment

Package: `com.scoretrackonline.app` · See `versionName` / `versionCode` in `android/app/build.gradle`.

Google Play requires a signed **Android App Bundle (`.aab`)**.

### Before you build

1. **`google-services.json`** — `npm run cap:android:firebase` (production project `scoretrack-48b01`, package `com.scoretrackonline.app`).
2. **Release signing key**
   - **First Play upload:** run `npm run cap:android:keystore` once. Back up `android/app/scoretrack-release.keystore` and `android/keystore.properties` — you need the same key for every update.
   - **App already on Play with another key:** do **not** generate a new keystore. Copy your existing upload keystore into `android/app/` and create `android/keystore.properties` to match `scripts/setup-android-release-keystore.sh`.
3. **Google Sign-In fingerprints** — register debug + release SHA-1/SHA-256 (and Play App Signing SHA-1 if using Play):
   ```bash
   REGISTER_SHA=1 npm run cap:android:sha
   ```
   Or print fingerprints only: `npm run cap:android:sha`, then add them in [Firebase → Android app](https://console.firebase.google.com/project/scoretrack-48b01/settings/general).
4. **Web env** — copy `.env.example` → `.env` (same Firebase web config is used inside the Capacitor WebView).

Web + Android share project `scoretrack-48b01`:
- Web app id: `1:132743863881:web:b63a7bb28c64c56633a998`
- Android app id: `1:132743863881:android:dd020e34e25af76533a998` (`com.scoretrackonline.app`)
- Auth domain: `scoretrackonline.com` (must remain in Firebase Auth → Authorized domains)

### Build the Play bundle

```bash
npm run cap:bundle:android:release
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

For a version bump before release (bumps `package.json`, `versionCode`, and `versionName`):

```bash
npm run cap:bump:android        # patch bump
npm run cap:bump:android:minor  # minor bump
npm run cap:bundle:android:release
```

The in-browser **Download now** prompt opens the Google Play listing  
(`https://play.google.com/store/apps/details?id=com.scoretrackonline.app`).

### Upload to Play Console

1. Open [Google Play Console](https://play.google.com/console) → your ScoreTrack app.
2. Confirm the app ID is **`com.scoretrackonline.app`** (must match `applicationId` in `android/app/build.gradle`).
3. **Release** → **Production** (or **Internal testing** for a dry run) → **Create new release**.
4. Upload `app-release.aab`.
5. Complete **store listing**, **content rating**, **data safety**, and **target audience** if not done yet.
6. Submit for review.

### Internal testing (recommended first)

Use **Internal testing** track, add your Google account as a tester, install from the Play link, then verify sign-in, scoring, and deep links before promoting to production.

---

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
