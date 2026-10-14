const COMMANDS: &[&str] = &["set_keep_alive"];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .build();
}
