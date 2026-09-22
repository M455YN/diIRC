# iOS IPA build (macOS only)

This branch prepares Luna IRC (Tauri 2) so you can generate a signed `.ipa` on a Mac.

## Prerequisites (one-time on the Mac)

1. **macOS** with full **Xcode** (not only Command Line Tools)
2. Open Xcode once, accept the license, sign in: **Xcode → Settings → Accounts**
3. **Apple ID** (free) for device/dev installs, or **Apple Developer Program** ($99/yr) for TestFlight / App Store
4. **Rust** via [rustup](https://rustup.rs/)
5. **Node.js LTS**
6. **Homebrew** + CocoaPods (`brew install cocoapods`) — the setup script installs CocoaPods if missing

## Quick start

```bash
git checkout feature/ios-ipa-build
npm run ios:setup          # deps, Rust iOS targets, tauri ios init
export APPLE_DEVELOPMENT_TEAM=XXXXXXXXXX   # optional but recommended (Team ID)
npm run ios:ipa            # debugging IPA (sideload / local device)
# or:
npm run ios:ipa:testflight # release-testing
npm run ios:ipa:store      # App Store Connect
```

Convenience copy of the newest IPA:

`dist-ios/*.ipa`

Tauri’s default location is under:

`src-tauri/gen/apple/build/`

## What the setup script does

- Verifies macOS / Xcode / rustup / Node
- `rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios`
- `npm ci`
- `npm run tauri ios init` if `src-tauri/gen/apple` is missing

The generated Xcode project lives in `src-tauri/gen/apple` (committed after first successful init on a Mac is optional but recommended for teammates).

## Signing notes

| Goal | Export method | npm script |
|------|---------------|------------|
| Dev / Ad Hoc style local IPA | `debugging` | `npm run ios:ipa` |
| TestFlight | `release-testing` | `npm run ios:ipa:testflight` |
| App Store | `app-store-connect` | `npm run ios:ipa:store` |

- Set Team ID: `export APPLE_DEVELOPMENT_TEAM=YourTeamID`
- Or open Xcode and enable **Automatically manage signing**:

```bash
npm run tauri -- ios build --open
```

Bundle ID is `com.diirc.app` (`src-tauri/tauri.conf.json` → `identifier`). Register the same App ID in [Apple Developer](https://developer.apple.com/) / App Store Connect when distributing beyond personal devices.

## Project changes for mobile

- `tauri-plugin-updater` / `tauri-plugin-process` are **desktop-only** (unsupported on iOS)
- `src-tauri/tauri.ios.conf.json` — iOS product name + no updater artifacts
- `src-tauri/Info.ios.plist` — local network / notification strings
- `src-tauri/capabilities/mobile.json` — mobile permissions without updater/process

## Manual Xcode archive (fallback)

```bash
npm run tauri -- ios build --open
```

Then in Xcode: **Product → Archive → Distribute App → export IPA**.

## Linux / Windows

You cannot produce an `.ipa` on Linux or Windows. Use a Mac or a `macos-latest` CI runner.
