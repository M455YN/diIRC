use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::MobileChrome;
#[cfg(mobile)]
use mobile::MobileChrome;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the mobile-chrome APIs.
pub trait MobileChromeExt<R: Runtime> {
  fn mobile_chrome(&self) -> &MobileChrome<R>;
}

impl<R: Runtime, T: Manager<R>> crate::MobileChromeExt<R> for T {
  fn mobile_chrome(&self) -> &MobileChrome<R> {
    self.state::<MobileChrome<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("mobile-chrome")
    .invoke_handler(tauri::generate_handler![
      commands::configure_tab_bar,
      commands::set_tab_bar_selected,
      commands::set_tab_bar_visible,
      commands::get_tab_bar_insets,
    ])
    .setup(|app, api| {
      #[cfg(mobile)]
      let mobile_chrome = mobile::init(app, api)?;
      #[cfg(desktop)]
      let mobile_chrome = desktop::init(app, api)?;
      app.manage(mobile_chrome);
      Ok(())
    })
    .build()
}
