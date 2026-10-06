use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::MobileChromeExt;
use crate::Result;

#[command]
pub(crate) async fn configure_tab_bar<R: Runtime>(
  app: AppHandle<R>,
  payload: ConfigureTabBarRequest,
) -> Result<ConfigureTabBarResponse> {
  app.mobile_chrome().configure_tab_bar(payload)
}

#[command]
pub(crate) async fn set_tab_bar_selected<R: Runtime>(
  app: AppHandle<R>,
  payload: SetTabBarSelectedRequest,
) -> Result<()> {
  app.mobile_chrome().set_tab_bar_selected(payload)
}

#[command]
pub(crate) async fn set_tab_bar_visible<R: Runtime>(
  app: AppHandle<R>,
  payload: SetTabBarVisibleRequest,
) -> Result<()> {
  app.mobile_chrome().set_tab_bar_visible(payload)
}

#[command]
pub(crate) async fn get_tab_bar_insets<R: Runtime>(app: AppHandle<R>) -> Result<TabBarInsets> {
  app.mobile_chrome().get_tab_bar_insets()
}
