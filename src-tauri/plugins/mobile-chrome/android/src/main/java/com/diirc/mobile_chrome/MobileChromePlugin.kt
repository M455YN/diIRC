package com.diirc.mobile_chrome

import android.app.Activity
import android.os.Build
import android.util.Log
import android.util.TypedValue
import android.view.MotionEvent
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONObject

@TauriPlugin
class MobileChromePlugin(private val activity: Activity) : Plugin(activity) {
    private var overlay: FrameLayout? = null
    private var tabBar: FloatingTabBarView? = null
    private var webView: WebView? = null

    private var items: List<TabItem> = emptyList()
    private var selectedId: String = "chats"
    private var visible: Boolean = true
    private var navBarInsetPx: Int = 0

    override fun load(webView: WebView) {
        this.webView = webView
        activity.runOnUiThread {
            ensureOverlay()
            updateNavInset()
        }
    }

    @Command
    fun configureTabBar(invoke: Invoke) {
        val args = invoke.parseArgs(ConfigureTabBarArgs::class.java)
        activity.runOnUiThread {
            ensureOverlay()
            items = args.items.map { TabItem(it.id, it.label) }
            selectedId = args.selectedId
            visible = args.visible
            updateNavInset()
            tabBar?.setTabs(items, selectedId)
            tabBar?.setBarVisible(visible)
            overlay?.visibility = if (visible && items.isNotEmpty()) ViewGroup.VISIBLE else ViewGroup.GONE

            val ret = JSObject()
            ret.put("native", true)
            ret.put("bottomInset", bottomInsetCssPx())
            invoke.resolve(ret)
        }
    }

    @Command
    fun setTabBarSelected(invoke: Invoke) {
        val args = invoke.parseArgs(SetTabBarSelectedArgs::class.java)
        activity.runOnUiThread {
            selectedId = args.id
            tabBar?.setSelected(args.id)
            invoke.resolve()
        }
    }

    @Command
    fun setTabBarVisible(invoke: Invoke) {
        val args = invoke.parseArgs(SetTabBarVisibleArgs::class.java)
        activity.runOnUiThread {
            visible = args.visible
            tabBar?.setBarVisible(visible)
            overlay?.visibility = if (visible && items.isNotEmpty()) ViewGroup.VISIBLE else ViewGroup.GONE
            invoke.resolve()
        }
    }

    @Command
    fun getTabBarInsets(invoke: Invoke) {
        activity.runOnUiThread {
            updateNavInset()
            val ret = JSObject()
            ret.put("bottom", if (visible && items.isNotEmpty()) bottomInsetCssPx() else 0.0)
            invoke.resolve(ret)
        }
    }

    private fun emitTabSelected(id: String) {
        selectedId = id
        tabBar?.setSelected(id)

        val payload = JSObject()
        payload.put("id", id)
        try {
            trigger("tab-selected", payload)
        } catch (e: Exception) {
            Log.w(TAG, "trigger(tab-selected) failed", e)
        }

        // Reliable bridge: plugin listeners are flaky across Tauri Android builds
        val escaped = JSONObject.quote(id)
        val js = """
            (function(){
              try {
                var id = $escaped;
                if (typeof window.__diircNativeTabSelected === 'function') {
                  window.__diircNativeTabSelected(id);
                }
                window.dispatchEvent(new CustomEvent('diirc-native-tab-selected', { detail: { id: id } }));
              } catch (e) {}
            })();
        """.trimIndent()
        val wv = webView
        if (wv != null) {
            wv.post { wv.evaluateJavascript(js, null) }
        } else {
            Log.w(TAG, "No WebView to deliver tab-selected=$id")
        }
    }

    private fun ensureOverlay() {
        if (overlay != null) return

        val root = activity.window.decorView as ViewGroup
        val bar = FloatingTabBarView(activity).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            onTabSelected = { id -> emitTabSelected(id) }
        }

        val hitTestContainer = object : FrameLayout(activity) {
            private var tracking = false

            override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
                if (!visible || items.isEmpty() || visibility != VISIBLE) {
                    tracking = false
                    return false
                }
                val bandTop = height - dp(TAB_BAR_HEIGHT_DP) - navBarInsetPx - dp(8)
                when (ev.actionMasked) {
                    MotionEvent.ACTION_DOWN -> {
                        if (ev.y < bandTop) {
                            tracking = false
                            return false
                        }
                        tracking = true
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        if (!tracking) return false
                        tracking = false
                    }
                    else -> if (!tracking) return false
                }
                return super.dispatchTouchEvent(ev)
            }
        }.apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            isClickable = false
            isFocusable = false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                elevation = TypedValue.applyDimension(
                    TypedValue.COMPLEX_UNIT_DIP,
                    24f,
                    resources.displayMetrics,
                )
            }
            addView(bar)
        }

        root.addView(hitTestContainer)
        overlay = hitTestContainer
        tabBar = bar
        ViewCompat.setOnApplyWindowInsetsListener(hitTestContainer) { _, insets ->
            navBarInsetPx = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom
            insets
        }
        ViewCompat.requestApplyInsets(hitTestContainer)
    }

    private fun updateNavInset() {
        val insets = ViewCompat.getRootWindowInsets(activity.window.decorView) ?: return
        navBarInsetPx = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom
    }

    private fun bottomInsetCssPx(): Double {
        val density = activity.resources.displayMetrics.density
        val barDp = (TAB_BAR_HEIGHT_DP + TAB_BAR_BOTTOM_PAD_DP).toDouble()
        val navDp = navBarInsetPx / density.toDouble()
        return barDp + navDp
    }

    private fun dp(value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            activity.resources.displayMetrics,
        ).toInt()
    }

    companion object {
        private const val TAG = "MobileChrome"
    }
}
