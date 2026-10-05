import { addPluginListener, invoke, type PluginListener } from '@tauri-apps/api/core'

export type MobileChromeTabId = 'servers' | 'chats' | 'more' | (string & {})

export interface TabBarItem {
  id: MobileChromeTabId
  label: string
}

export interface ConfigureTabBarOptions {
  items: TabBarItem[]
  selectedId: MobileChromeTabId
  visible: boolean
}

export interface ConfigureTabBarResult {
  native: boolean
  bottomInset: number
}

export interface TabBarInsets {
  bottom: number
}

export interface TabSelectedEvent {
  id: MobileChromeTabId
}

export async function configureTabBar(
  options: ConfigureTabBarOptions,
): Promise<ConfigureTabBarResult> {
  return await invoke<ConfigureTabBarResult>('plugin:mobile-chrome|configure_tab_bar', {
    payload: options,
  })
}

export async function setTabBarSelected(id: MobileChromeTabId): Promise<void> {
  await invoke('plugin:mobile-chrome|set_tab_bar_selected', {
    payload: { id },
  })
}

export async function setTabBarVisible(visible: boolean): Promise<void> {
  await invoke('plugin:mobile-chrome|set_tab_bar_visible', {
    payload: { visible },
  })
}

export async function getTabBarInsets(): Promise<TabBarInsets> {
  return await invoke<TabBarInsets>('plugin:mobile-chrome|get_tab_bar_insets')
}

/** Listen for native tab taps (`mobile-chrome://tab-selected`). */
export async function onTabSelected(
  handler: (event: TabSelectedEvent) => void,
): Promise<PluginListener> {
  return await addPluginListener('mobile-chrome', 'tab-selected', handler)
}
