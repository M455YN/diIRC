package com.diirc.keepalive

import android.app.Activity
import android.content.Intent
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class SetKeepAliveArgs {
    var enabled: Boolean = false
}

@TauriPlugin
class KeepAlivePlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun setKeepAlive(invoke: Invoke) {
        val args = invoke.parseArgs(SetKeepAliveArgs::class.java)
        val intent = Intent(activity, KeepAliveService::class.java)
        if (args.enabled) {
            ContextCompat.startForegroundService(activity, intent)
        } else {
            activity.stopService(intent)
        }
        invoke.resolve()
    }
}
