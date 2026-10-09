use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabBarItem {
  pub id: String,
  pub label: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureTabBarRequest {
  pub items: Vec<TabBarItem>,
  pub selected_id: String,
  pub visible: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureTabBarResponse {
  /// True when a native tab bar is active on this platform.
  pub native: bool,
  pub bottom_inset: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTabBarSelectedRequest {
  pub id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTabBarVisibleRequest {
  pub visible: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabBarInsets {
  pub bottom: f64,
}
