# tauri-plugin-mobile-chrome

Native floating tab bar overlay for Tauri mobile:

- **Android:** floating glass-style pill over the WebView (Android Views; Compose hits a Kotlin/AGP ICE in Tauri’s generated Gradle graph)
- **iOS:** SwiftUI floating bar with Liquid Glass on iOS 26+ (`glassEffect`), `.ultraThinMaterial` fallback

## Commands

- `configure_tab_bar` — create/update the floating bar
- `set_tab_bar_selected` — sync selected tab from the WebView
- `set_tab_bar_visible` — hide when the keyboard is open
- `get_tab_bar_insets` — bottom inset (CSS px) for content padding

## Events

- `tab-selected` — `{ id }` when the user taps a native tab (`mobile-chrome://tab-selected`)

## App iOS project

On a Mac with Xcode, from the repo root:

```bash
npx tauri ios init
npx tauri ios build --debug
```

`src-tauri/gen/ios/` is gitignored (same as Android).
