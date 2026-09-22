#!/usr/bin/env bash
# One-time (and idempotent) macOS setup for building Luna IRC iOS IPA.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

if [[ "$(uname -s)" != "Darwin" ]]; then
  red "iOS builds require macOS + Xcode. Current OS: $(uname -s)"
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  red "xcodebuild not found. Install full Xcode from the Mac App Store, then open it once."
  exit 1
fi

if ! xcode-select -p >/dev/null 2>&1; then
  red "Xcode developer directory is not selected. Run: sudo xcode-select -s /Applications/Xcode.app"
  exit 1
fi

if ! command -v rustup >/dev/null 2>&1; then
  red "rustup not found. Install Rust: https://rustup.rs/"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  red "Node.js not found. Install LTS from https://nodejs.org/"
  exit 1
fi

if ! command -v pod >/dev/null 2>&1; then
  yellow "CocoaPods missing — trying Homebrew install..."
  if ! command -v brew >/dev/null 2>&1; then
    red "Homebrew not found. Install from https://brew.sh/ then re-run this script."
    exit 1
  fi
  brew install cocoapods
fi

green "Adding Rust iOS targets..."
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios

green "Installing npm dependencies..."
npm ci

APPLE_DIR="src-tauri/gen/apple"
if [[ ! -d "$APPLE_DIR" ]]; then
  green "Initializing Tauri iOS project (tauri ios init)..."
  npm run tauri ios init
else
  yellow "iOS project already present at $APPLE_DIR — skipping init."
fi

# Refresh icons into the generated Xcode project when present.
if [[ -f "src-tauri/icons/icon.png" ]] || [[ -f "src-tauri/app-icon.png" ]]; then
  yellow "Tip: run 'npm run tauri icon' with a 1024x1024 PNG if you change branding."
fi

green "Setup complete."
echo
echo "Next steps on this Mac:"
echo "  1. Open Xcode once and sign in with your Apple ID (Xcode → Settings → Accounts)."
echo "  2. Optional: export APPLE_DEVELOPMENT_TEAM=XXXXXXXXXX  # 10-char Team ID"
echo "  3. Build a signed IPA:"
echo "       npm run ios:ipa"
echo "     or for App Store / TestFlight:"
echo "       npm run ios:ipa:store"
echo
echo "See docs/IOS_BUILD.md for signing details and IPA output paths."
