#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/android/app/google-services.json"
PROJECT_ID="${FIREBASE_PROJECT_ID:-scoretrack-48b01}"
PACKAGE_NAME="${ANDROID_PACKAGE_NAME:-com.scoretrack.app}"

echo "Firebase project: $PROJECT_ID"
echo "Android package:  $PACKAGE_NAME"
echo ""

if ! command -v firebase >/dev/null 2>&1; then
  echo "firebase CLI not found. Run: npm install"
  exit 1
fi

echo "Listing Android apps..."
APPS_JSON="$(firebase apps:list --project "$PROJECT_ID" --json 2>/dev/null || true)"

APP_ID=""
if [[ -n "$APPS_JSON" ]]; then
  APP_ID="$(node -e "
    const apps = JSON.parse(process.argv[1]).result?.apps ?? [];
    const android = apps.find(a => a.platform === 'ANDROID' && a.namespace === process.argv[2]);
    if (android) process.stdout.write(android.appId);
  " "$APPS_JSON" "$PACKAGE_NAME" 2>/dev/null || true)"
fi

if [[ -z "$APP_ID" ]]; then
  echo "No Android app for $PACKAGE_NAME — creating one..."
  CREATE_JSON="$(firebase apps:create android "$PACKAGE_NAME" \
    --project "$PROJECT_ID" \
    --package-name "$PACKAGE_NAME" \
    --json)"
  APP_ID="$(node -e "process.stdout.write(JSON.parse(process.argv[1]).result.appId)" "$CREATE_JSON")"
  echo "Created Firebase Android app: $APP_ID"
fi

echo "Downloading google-services.json..."
firebase apps:sdkconfig ANDROID "$APP_ID" \
  --project "$PROJECT_ID" \
  --out "$OUT"

echo "Wrote $OUT"
