use serde::{Deserialize, Serialize};
use tauri::{
  plugin::{Builder, TauriPlugin},
  Runtime,
};

#[cfg(mobile)]
mod mobile;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetKeepAliveRequest {
  pub enabled: bool,
}

/// Starts or stops the Android foreground service. Desktop has no background suspension, so it is a no-op there.
#[cfg(mobile)]
#[tauri::command]
async fn set_keep_alive<R: Runtime>(
  app: tauri::AppHandle<R>,
  payload: SetKeepAliveRequest,
) -> Result<(), String> {
  use tauri::Manager;
  app
    .state::<mobile::KeepAlive<R>>()
    .set(payload)
    .map_err(|e| e.to_string())
}

#[cfg(desktop)]
#[tauri::command]
async fn set_keep_alive(_payload: SetKeepAliveRequest) -> Result<(), String> {
  Ok(())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("keep-alive")
    .invoke_handler(tauri::generate_handler![set_keep_alive])
    .setup(|app, api| {
      #[cfg(mobile)]
      {
        use tauri::Manager;
        app.manage(mobile::init(api)?);
      }
      #[cfg(desktop)]
      let _ = (app, api);
      Ok(())
    })
    .build()
}
