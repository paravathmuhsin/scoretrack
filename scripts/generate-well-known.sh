#!/usr/bin/env bash
set -euo pipefail

# Regenerates public/.well-known/assetlinks.json from Android keystores.
# Set APPLE_TEAM_ID to refresh iOS universal links (apple-app-site-association).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/public/.well-known"
PACKAGE="com.scoretrackonline.app"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"
# Optional: Play Console → Protected with Play → App signing → SHA-256
# (Digital Asset Links JSON / App signing key certificate)
PLAY_SHA256="${PLAY_SHA256:-E4:ED:4D:EC:71:37:21:A3:CA:D4:BF:A6:94:45:29:4F:ED:9A:C4:C6:47:2E:88:F5:7F:4F:84:19:0B:16:FE:EC}"

sha256_fingerprint() {
  keytool -list -v -keystore "$1" -alias "$2" -storepass "$3" -keypass "$3" 2>/dev/null \
    | awk -F': ' '/SHA256:/{print $2; exit}'
}

FINGERPRINTS=()

if [[ -f "$HOME/.android/debug.keystore" ]]; then
  FP="$(sha256_fingerprint "$HOME/.android/debug.keystore" androiddebugkey android || true)"
  [[ -n "$FP" ]] && FINGERPRINTS+=("$FP")
fi

RELEASE_KS="$ROOT/android/app/scoretrack-release.keystore"
PROPS="$ROOT/android/keystore.properties"
if [[ -f "$RELEASE_KS" && -f "$PROPS" ]]; then
  storePassword="$(grep -E '^storePassword=' "$PROPS" | sed 's/^storePassword=//' | tr -d '\r')"
  keyAlias="$(grep -E '^keyAlias=' "$PROPS" | sed 's/^keyAlias=//' | tr -d '\r')"
  keyAlias="${keyAlias:-scoretrack}"
  FP="$(sha256_fingerprint "$RELEASE_KS" "$keyAlias" "$storePassword" || true)"
  [[ -n "$FP" ]] && FINGERPRINTS+=("$FP")
fi

if [[ -n "$PLAY_SHA256" ]]; then
  FINGERPRINTS+=("$PLAY_SHA256")
fi

if [[ ${#FINGERPRINTS[@]} -eq 0 ]]; then
  echo "No keystore fingerprints found. Run: npm run cap:android:keystore"
  exit 1
fi

mkdir -p "$OUT_DIR"

node -e "
const fps = process.argv.slice(1);
const doc = [{
  relation: ['delegate_permission/common.handle_all_urls'],
  target: {
    namespace: 'android_app',
    package_name: '$PACKAGE',
    sha256_cert_fingerprints: fps,
  },
}];
require('fs').writeFileSync('$OUT_DIR/assetlinks.json', JSON.stringify(doc, null, 2) + '\n');
" "${FINGERPRINTS[@]}"

echo "Wrote $OUT_DIR/assetlinks.json (${#FINGERPRINTS[@]} fingerprint(s))"

if [[ -n "$APPLE_TEAM_ID" ]]; then
  node -e "
const fs = require('fs');
const doc = {
  applinks: {
    apps: [],
    details: [{
      appID: '${APPLE_TEAM_ID}.$PACKAGE',
      paths: ['/live/*','/overlay/*','/player/*','/tournaments/*','/app/*','/login','/register','/*'],
    }],
  },
};
fs.writeFileSync('$OUT_DIR/apple-app-site-association', JSON.stringify(doc, null, 2) + '\n');
"
  echo "Wrote $OUT_DIR/apple-app-site-association (team $APPLE_TEAM_ID)"
else
  echo "Tip: APPLE_TEAM_ID=XXXXXXXXXX $0  # to update iOS universal links"
fi
