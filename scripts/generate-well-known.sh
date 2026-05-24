#!/usr/bin/env bash
set -euo pipefail

# Regenerates public/.well-known/assetlinks.json from Android keystores.
# Set APPLE_TEAM_ID to refresh iOS universal links (apple-app-site-association).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/public/.well-known"
PACKAGE="com.scoretrack.app"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"

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
  # shellcheck disable=SC1090
  source <(grep -E '^(storePassword|keyAlias)=' "$PROPS" | sed 's/\r$//')
  FP="$(sha256_fingerprint "$RELEASE_KS" "${keyAlias:-scoretrack}" "$storePassword" || true)"
  [[ -n "$FP" ]] && FINGERPRINTS+=("$FP")
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
