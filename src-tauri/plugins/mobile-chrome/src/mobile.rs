use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_mobile_chrome);

pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<MobileChrome<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("com.diirc.mobile_chrome", "MobileChromePlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_mobile_chrome)?;
  Ok(MobileChrome(handle))
}

/// Access to the mobile-chrome APIs.
pub struct MobileChrome<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> MobileChrome<R> {
  pub fn configure_tab_bar(
    &self,
    payload: ConfigureTabBarRequest,
  ) -> crate::Result<ConfigureTabBarResponse> {
    self
      .0
      .run_mobile_plugin("configureTabBar", payload)
      .map_err(Into::into)
  }

  pub fn set_tab_bar_selected(&self, payload: SetTabBarSelectedRequest) -> crate::Result<()> {
    self
      .0
      .run_mobile_plugin("setTabBarSelected", payload)
      .map_err(Into::into)
  }

  pub fn set_tab_bar_visible(&self, payload: SetTabBarVisibleRequest) -> crate::Result<()> {
    self
      .0
      .run_mobile_plugin("setTabBarVisible", payload)
      .map_err(Into::into)
  }

  pub fn get_tab_bar_insets(&self) -> crate::Result<TabBarInsets> {
    self
      .0
      .run_mobile_plugin("getTabBarInsets", ())
      .map_err(Into::into)
  }
}
