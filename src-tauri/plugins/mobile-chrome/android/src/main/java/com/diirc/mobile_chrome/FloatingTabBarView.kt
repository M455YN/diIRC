package com.diirc.mobile_chrome

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.util.AttributeSet
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.graphics.ColorUtils
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/** Material Design 3 Navigation Bar height (excluding system nav inset). */
internal const val TAB_BAR_HEIGHT_DP = 80
internal const val TAB_BAR_BOTTOM_PAD_DP = 0
internal const val TAB_BAR_HORIZONTAL_PAD_DP = 0

/**
 * Full-width Material Design 3 bottom navigation bar.
 * Active item uses the MD3 tonal indicator pill behind the icon.
 */
class FloatingTabBarView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : FrameLayout(context, attrs) {

    // Hardcoded MD3 baseline — theme attrs were resolving to invisible contrast.
    private val colorSurface = Color.parseColor("#F3EDF7")
    private val colorPrimary = Color.parseColor("#6750A4")
    private val colorOnSurfaceVariant = Color.parseColor("#49454F")
    private val colorSecondaryContainer = Color.parseColor("#E8DEF8")

    private val surface = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER
        setBackgroundColor(colorSurface)
        elevation = dp(6f)
    }

    private var items: List<TabItem> = emptyList()
    private var selectedId: String = "chats"
    private var selectedIndex: Int = 1

    var onTabSelected: ((String) -> Unit)? = null

    init {
        clipChildren = false
        clipToPadding = false
        setBackgroundColor(Color.TRANSPARENT)
        addView(
            surface,
            LayoutParams(LayoutParams.MATCH_PARENT, dp(TAB_BAR_HEIGHT_DP)).apply {
                gravity = Gravity.BOTTOM
            },
        )

        ViewCompat.setOnApplyWindowInsetsListener(this) { _, insets ->
            val nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom
            surface.setPadding(0, 0, 0, nav)
            (surface.layoutParams as LayoutParams).height = dp(TAB_BAR_HEIGHT_DP) + nav
            surface.requestLayout()
            insets
        }
    }

    fun setTabs(items: List<TabItem>, selectedId: String) {
        this.items = items
        this.selectedId = selectedId
        this.selectedIndex = indexOfId(selectedId).coerceAtLeast(0)
        rebuild()
    }

    fun setSelected(id: String) {
        if (selectedId == id) return
        selectedId = id
        selectedIndex = indexOfId(id).coerceAtLeast(0)
        refreshTabStyles()
    }

    fun setBarVisible(visible: Boolean) {
        visibility = if (visible && items.isNotEmpty()) View.VISIBLE else View.GONE
    }

    private fun rebuild() {
        surface.removeAllViews()
        items.forEachIndexed { index, item ->
            surface.addView(
                createTabButton(item, index),
                LinearLayout.LayoutParams(0, LayoutParams.MATCH_PARENT, 1f),
            )
        }
        refreshTabStyles()
    }

    private fun createTabButton(item: TabItem, index: Int): View {
        val column = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL or Gravity.CENTER_VERTICAL
            isClickable = true
            isFocusable = true
            contentDescription = item.label
            setPadding(dp(4), dp(8), dp(4), dp(8))
            tag = index
            background = RippleDrawable(
                ColorStateList.valueOf(ColorUtils.setAlphaComponent(colorPrimary, 0x40)),
                null,
                GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    setColor(Color.WHITE)
                },
            )
            setOnClickListener { commitSelection(index) }
        }

        val indicator = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(dp(64), dp(32)).apply {
                gravity = Gravity.CENTER_HORIZONTAL
            }
            tag = "indicator"
        }

        val icon = ImageView(context).apply {
            setImageResource(iconRes(item.id))
            layoutParams = FrameLayout.LayoutParams(dp(24), dp(24)).apply {
                gravity = Gravity.CENTER
            }
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
            tag = "icon"
        }
        indicator.addView(icon)

        val label = TextView(context).apply {
            text = item.label
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            gravity = Gravity.CENTER
            setPadding(0, dp(4), 0, 0)
            setTextColor(colorOnSurfaceVariant)
            tag = "label"
        }

        column.addView(indicator)
        column.addView(label)
        return column
    }

    private fun refreshTabStyles() {
        for (i in 0 until surface.childCount) {
            val column = surface.getChildAt(i) as? LinearLayout ?: continue
            val isActive = i == selectedIndex
            val tint = if (isActive) colorPrimary else colorOnSurfaceVariant

            (column.findViewWithTag<FrameLayout>("indicator"))?.background =
                if (isActive) indicatorDrawable() else null

            (column.findViewWithTag<ImageView>("icon"))?.apply {
                clearColorFilter()
                setColorFilter(tint)
                imageAlpha = 255
                visibility = View.VISIBLE
            }
            (column.findViewWithTag<TextView>("label"))?.apply {
                setTextColor(tint)
                typeface = Typeface.create(
                    if (isActive) "sans-serif-medium" else "sans-serif",
                    Typeface.NORMAL,
                )
                visibility = View.VISIBLE
            }
        }
    }

    private fun commitSelection(index: Int) {
        val item = items.getOrNull(index) ?: return
        selectedIndex = index
        selectedId = item.id
        refreshTabStyles()
        onTabSelected?.invoke(item.id)
    }

    private fun indexOfId(id: String): Int = items.indexOfFirst { it.id == id }

    private fun iconRes(id: String): Int = when (id) {
        "servers" -> R.drawable.ic_tab_servers
        "chats" -> R.drawable.ic_tab_chats
        "more" -> R.drawable.ic_tab_more
        else -> R.drawable.ic_tab_more
    }

    private fun indicatorDrawable(): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(16f)
            setColor(colorSecondaryContainer)
        }

    private fun dp(value: Int): Int =
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics,
        ).toInt()

    private fun dp(value: Float): Float =
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            resources.displayMetrics,
        )
}
