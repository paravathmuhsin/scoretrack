#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${FIREBASE_PROJECT_ID:-scoretrack-48b01}"
ANDROID_APP_ID="${FIREBASE_ANDROID_APP_ID:-1:132743863881:android:de1627295fdfbd9233a998}"

print_sha() {
  local label="$1"
  local keystore="$2"
  local storepass="$3"
  local alias="$4"
  echo "=== $label ==="
  keytool -list -v -keystore "$keystore" -alias "$alias" -storepass "$storepass" -keypass "$storepass" 2>/dev/null \
    | grep -E 'SHA1:|SHA256:' || echo "(not found)"
}

print_sha "Debug (~/.android/debug.keystore)" "$HOME/.android/debug.keystore" android androiddebugkey

RELEASE_KS="$ROOT/android/app/scoretrack-release.keystore"
PROPS="$ROOT/android/keystore.properties"
if [[ -f "$RELEASE_KS" && -f "$PROPS" ]]; then
  # shellcheck disable=SC1090
  source <(grep -E '^(storePassword|keyAlias)=' "$PROPS" | sed 's/\r$//')
  print_sha "Release" "$RELEASE_KS" "$storePassword" "${keyAlias:-scoretrack}"
fi

echo ""
echo "Required for Google Sign-In on Android (fixes error code 10):"
echo "  Firebase Console → Project settings → ScoreTrack Android app → Add fingerprint"
echo "  Add EVERY SHA-1 below for the APKs you install (debug + release)."
echo ""
echo "Or register via CLI (after firebase login):"
echo "  firebase apps:android:sha:create $ANDROID_APP_ID <SHA1> --project $PROJECT_ID"
echo ""
echo "After adding fingerprints: download google-services.json, then:"
echo "  npm run cap:android:firebase && npm run cap:sync"
