#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${FIREBASE_PROJECT_ID:-scoretrack-48b01}"
ANDROID_APP_ID="${FIREBASE_ANDROID_APP_ID:-1:132743863881:android:dd020e34e25af76533a998}"
REGISTER="${REGISTER_SHA:-0}"

print_sha() {
  local label="$1"
  local keystore="$2"
  local storepass="$3"
  local alias="$4"
  echo "=== $label ==="
  keytool -list -v -keystore "$keystore" -alias "$alias" -storepass "$storepass" -keypass "$storepass" 2>/dev/null \
    | grep -E 'SHA1:|SHA256:' || echo "(not found)"
}

register_keystore_hashes() {
  local label="$1"
  local keystore="$2"
  local storepass="$3"
  local alias="$4"
  local hash
  while IFS= read -r hash; do
    [[ -n "$hash" ]] || continue
    echo "Registering $label → $hash"
    if npx firebase apps:android:sha:create "$ANDROID_APP_ID" "$hash" --project "$PROJECT_ID" >/dev/null 2>&1; then
      echo "  OK"
    else
      echo "  (already registered or skipped)"
    fi
  done < <(
    keytool -list -v -keystore "$keystore" -alias "$alias" -storepass "$storepass" -keypass "$storepass" 2>/dev/null \
      | awk '
        /SHA1:/ { gsub(/SHA1:|[[:space:]:]/, ""); print tolower($0) }
        /SHA256:/ { gsub(/SHA256:|[[:space:]:]/, ""); print tolower($0) }
      '
  )
}

print_sha "Debug (~/.android/debug.keystore)" "$HOME/.android/debug.keystore" android androiddebugkey

RELEASE_KS="$ROOT/android/app/scoretrack-release.keystore"
PROPS="$ROOT/android/keystore.properties"
RELEASE_PASS=""
RELEASE_ALIAS="scoretrack"
if [[ -f "$RELEASE_KS" && -f "$PROPS" ]]; then
  RELEASE_PASS="$(grep -E '^storePassword=' "$PROPS" | sed 's/^storePassword=//' | tr -d '\r')"
  RELEASE_ALIAS="$(grep -E '^keyAlias=' "$PROPS" | sed 's/^keyAlias=//' | tr -d '\r')"
  RELEASE_ALIAS="${RELEASE_ALIAS:-scoretrack}"
  print_sha "Release" "$RELEASE_KS" "$RELEASE_PASS" "$RELEASE_ALIAS"
fi

echo ""
echo "Firebase Android app: $ANDROID_APP_ID ($PROJECT_ID)"
echo "Package: com.scoretrackonline.app"
echo ""

if [[ "$REGISTER" == "1" ]]; then
  echo "Registering local keystore SHA-1 / SHA-256 with Firebase..."
  register_keystore_hashes "debug" "$HOME/.android/debug.keystore" android androiddebugkey
  if [[ -n "$RELEASE_PASS" ]]; then
    register_keystore_hashes "release" "$RELEASE_KS" "$RELEASE_PASS" "$RELEASE_ALIAS"
  fi
  echo ""
  echo "Refreshing google-services.json..."
  bash "$ROOT/scripts/fetch-google-services.sh"
else
  echo "Required for Google Sign-In on Android (fixes error code 10):"
  echo "  Firebase Console → Project settings → Android app (com.scoretrackonline.app) → Add fingerprint"
  echo "  Add EVERY SHA-1 (and SHA-256) for the APKs you install (debug + release)."
  echo ""
  echo "Or auto-register via CLI:"
  echo "  REGISTER_SHA=1 npm run cap:android:sha"
  echo ""
  echo "After adding fingerprints: download google-services.json, then:"
  echo "  npm run cap:android:firebase && npm run cap:sync"
fi

echo ""
echo "Note: If the app is on Google Play with Play App Signing, also add the"
echo "Play Console → App signing key certificate SHA-1 to Firebase."
