#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUMP="${1:-patch}"
if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "Usage: bash scripts/android-release.sh [patch|minor|major]"
  exit 1
fi

LATEST_DIR="$ROOT/releases/latest"
PREVOUSE_DIR="$ROOT/releases/prevouse"
LATEST_APK="$LATEST_DIR/ScoreTrack.apk"

mkdir -p "$LATEST_DIR" "$PREVOUSE_DIR"

read_package_version() {
  node --input-type=module -e "
    import { readFileSync } from 'node:fs'
    console.log(JSON.parse(readFileSync('package.json', 'utf8')).version)
  "
}

CURRENT_VERSION="$(read_package_version)"

if [[ -f "$LATEST_APK" ]]; then
  ARCHIVE_NAME="ScoreTrack-v${CURRENT_VERSION}.apk"
  mv "$LATEST_APK" "$PREVOUSE_DIR/$ARCHIVE_NAME"
  echo "Archived releases/latest/ScoreTrack.apk -> releases/prevouse/$ARCHIVE_NAME"
  node scripts/bump-app-version.mjs "$BUMP"
  NEW_VERSION="$(read_package_version)"
else
  echo "No releases/latest/ScoreTrack.apk — skipping archive and version bump."
  NEW_VERSION="$CURRENT_VERSION"
fi

echo "Building Android release ${NEW_VERSION}..."

npm run cap:build:android:release

RELEASE_APK=""
for candidate in \
  "$ROOT/android/app/build/outputs/apk/release/app-release.apk" \
  "$ROOT/android/app/build/outputs/apk/release/app-release-unsigned.apk"; do
  if [[ -f "$candidate" ]]; then
    RELEASE_APK="$candidate"
    break
  fi
done

if [[ -z "$RELEASE_APK" ]]; then
  echo "Release APK not found under android/app/build/outputs/apk/release/"
  exit 1
fi

cp "$RELEASE_APK" "$LATEST_APK"
echo ""
echo "Release ready:"
echo "  releases/latest/ScoreTrack.apk ($NEW_VERSION)"
if [[ -f "$PREVOUSE_DIR/ScoreTrack-v${CURRENT_VERSION}.apk" ]]; then
  echo "  releases/prevouse/ScoreTrack-v${CURRENT_VERSION}.apk"
fi
