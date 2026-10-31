package de.feuerwehrwasser.h2o
import android.app.Activity
import android.os.Bundle
import android.widget.FrameLayout
class WidgetPreviewActivity : Activity() {
    lateinit var canvas: FrameLayout
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        canvas = FrameLayout(this)
        setContentView(canvas)
    }
}
