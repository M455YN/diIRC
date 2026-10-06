#!/usr/bin/env bash
# Run on a Mac with Xcode. Initializes the iOS project (if needed), builds,
# and prints where to confirm the native floating tab bar.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on macOS with Xcode." >&2
  exit 1
fi

if [[ ! -d src-tauri/gen/ios ]]; then
  echo "Initializing Tauri iOS project..."
  npx tauri ios init
fi

echo "Building iOS debug..."
npx tauri ios build --debug

echo
echo "Success criteria:"
echo "  - Native floating tab bar (Servers / Chats / More) appears above the WebView"
echo "  - CSS glass pill is hidden (useNativeMobileTabBar === true)"
echo "  - On iOS 26+, bar uses Liquid Glass (glassEffect)"
echo "  - Keyboard open hides the native bar"
echo
echo "Launch the app on a simulator or device to verify."
