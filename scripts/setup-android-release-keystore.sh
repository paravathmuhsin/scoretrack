#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
KEYSTORE="$ANDROID_DIR/app/scoretrack-release.keystore"
PROPS="$ANDROID_DIR/keystore.properties"

if [[ -f "$KEYSTORE" && -f "$PROPS" ]]; then
  echo "Release keystore already exists:"
  echo "  $KEYSTORE"
  echo "  $PROPS"
  exit 0
fi

STORE_PASS="${ANDROID_KEYSTORE_PASSWORD:-}"
KEY_PASS="${ANDROID_KEY_PASSWORD:-}"

if [[ -z "$STORE_PASS" ]]; then
  STORE_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
fi
if [[ -z "$KEY_PASS" ]]; then
  KEY_PASS="$STORE_PASS"
fi

keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore "$KEYSTORE" \
  -alias scoretrack \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  -dname "CN=ScoreTrack, OU=Mobile, O=ScoreTrack, L=Unknown, ST=Unknown, C=US"

cat > "$PROPS" <<EOF
storeFile=app/scoretrack-release.keystore
storePassword=$STORE_PASS
keyAlias=scoretrack
keyPassword=$KEY_PASS
EOF

chmod 600 "$PROPS"

echo "Created release keystore:"
echo "  $KEYSTORE"
echo "  $PROPS"
echo ""
echo "Back up the keystore and passwords — you need them for every Play Store update."
echo "Passwords are stored only in keystore.properties (gitignored)."
