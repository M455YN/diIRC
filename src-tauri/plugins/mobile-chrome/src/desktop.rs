use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<MobileChrome<R>> {
  Ok(MobileChrome(app.clone()))
}

/// Desktop stub — native chrome is mobile-only.
pub struct MobileChrome<R: Runtime>(AppHandle<R>);

impl<R: Runtime> MobileChrome<R> {
  pub fn configure_tab_bar(
    &self,
    _payload: ConfigureTabBarRequest,
  ) -> crate::Result<ConfigureTabBarResponse> {
    Ok(ConfigureTabBarResponse {
      native: false,
      bottom_inset: 0.0,
    })
  }

  pub fn set_tab_bar_selected(&self, _payload: SetTabBarSelectedRequest) -> crate::Result<()> {
    Ok(())
  }

  pub fn set_tab_bar_visible(&self, _payload: SetTabBarVisibleRequest) -> crate::Result<()> {
    Ok(())
  }

  pub fn get_tab_bar_insets(&self) -> crate::Result<TabBarInsets> {
    Ok(TabBarInsets { bottom: 0.0 })
  }
}
