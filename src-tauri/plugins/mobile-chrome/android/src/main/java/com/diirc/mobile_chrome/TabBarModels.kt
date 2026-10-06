package com.diirc.mobile_chrome

import app.tauri.annotation.InvokeArg

@InvokeArg
class TabBarItemArg {
    lateinit var id: String
    lateinit var label: String
}

@InvokeArg
class ConfigureTabBarArgs {
    var items: List<TabBarItemArg> = emptyList()
    lateinit var selectedId: String
    var visible: Boolean = true
}

@InvokeArg
class SetTabBarSelectedArgs {
    lateinit var id: String
}

@InvokeArg
class SetTabBarVisibleArgs {
    var visible: Boolean = true
}

data class TabItem(val id: String, val label: String)
