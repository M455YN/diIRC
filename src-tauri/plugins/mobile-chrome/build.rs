const COMMANDS: &[&str] = &[
  "configure_tab_bar",
  "set_tab_bar_selected",
  "set_tab_bar_visible",
  "get_tab_bar_insets",
];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .ios_path("ios")
    .build();
}
