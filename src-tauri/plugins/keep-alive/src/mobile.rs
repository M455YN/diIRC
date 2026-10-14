use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  Runtime,
};

use crate::SetKeepAliveRequest;

/// Handle to the Kotlin `KeepAlivePlugin`.
pub struct KeepAlive<R: Runtime>(PluginHandle<R>);

pub fn init<R: Runtime, C: DeserializeOwned>(
  api: PluginApi<R, C>,
) -> Result<KeepAlive<R>, Box<dyn std::error::Error>> {
  let handle = api.register_android_plugin("com.diirc.keepalive", "KeepAlivePlugin")?;
  Ok(KeepAlive(handle))
}

impl<R: Runtime> KeepAlive<R> {
  pub fn set(&self, payload: SetKeepAliveRequest) -> Result<(), tauri::plugin::mobile::PluginInvokeError> {
    self.0.run_mobile_plugin::<()>("setKeepAlive", payload)
  }
}
