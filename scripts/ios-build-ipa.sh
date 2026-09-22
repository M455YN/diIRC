#!/usr/bin/env bash
# Build a signed .ipa for iOS. Must run on macOS after scripts/ios-setup.sh.
# Compatible with macOS system bash 3.2.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

if [[ "$(uname -s)" != "Darwin" ]]; then
  red "iOS builds require macOS + Xcode."
  exit 1
fi

EXPORT_METHOD="${1:-debugging}"
case "$EXPORT_METHOD" in
  debugging|release-testing|app-store-connect) ;;
  *)
    red "Unknown export method: $EXPORT_METHOD"
    echo "Usage: $0 [debugging|release-testing|app-store-connect]"
    exit 1
    ;;
esac

if [[ ! -d "src-tauri/gen/apple" ]]; then
  yellow "iOS project missing — running setup first..."
  bash "$ROOT/scripts/ios-setup.sh"
fi

if [[ -z "${APPLE_DEVELOPMENT_TEAM:-}" ]]; then
  yellow "APPLE_DEVELOPMENT_TEAM is unset."
  yellow "Find Team ID: Xcode → Settings → Accounts → your Apple ID → Team → Team ID"
  yellow "Then: export APPLE_DEVELOPMENT_TEAM=AB12CD34EF"
  yellow "Or open Xcode once: npm run ios:open  → Signing & Capabilities → select your Personal Team"
elif [[ "${APPLE_DEVELOPMENT_TEAM}" == "XXXXXXXXXX" || "${APPLE_DEVELOPMENT_TEAM}" == "Your10CharTeamID" ]]; then
  red "APPLE_DEVELOPMENT_TEAM is still the placeholder (${APPLE_DEVELOPMENT_TEAM})."
  red "Replace it with your real 10-character Team ID from Xcode → Settings → Accounts."
  exit 1
fi

green "Building iOS IPA (export-method=$EXPORT_METHOD)..."
npm run tauri -- ios build --export-method "$EXPORT_METHOD"

green "Looking for generated .ipa files..."
IPA_LIST="$(find src-tauri/gen/apple -type f -name '*.ipa' 2>/dev/null | sort || true)"

if [[ -z "$IPA_LIST" ]]; then
  yellow "No .ipa found under src-tauri/gen/apple."
  yellow "Open the Xcode project and archive manually:"
  echo "  npm run tauri -- ios build --open"
  exit 1
fi

green "IPA ready:"
echo "$IPA_LIST" | while IFS= read -r ipa; do
  [[ -n "$ipa" ]] && echo "  $ipa"
done

OUT_DIR="$ROOT/dist-ios"
mkdir -p "$OUT_DIR"

NEWEST="$(find src-tauri/gen/apple -type f -name '*.ipa' -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -n1 || true)"
if [[ -z "$NEWEST" ]]; then
  NEWEST="$(echo "$IPA_LIST" | tail -n1)"
fi

BASENAME="$(basename "$NEWEST")"
cp -f "$NEWEST" "$OUT_DIR/$BASENAME"
green "Copied to: $OUT_DIR/$BASENAME"
