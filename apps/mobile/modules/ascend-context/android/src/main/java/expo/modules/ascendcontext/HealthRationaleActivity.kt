package expo.modules.ascendcontext

import android.app.Activity
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Button
import android.graphics.Color

class HealthRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val parent = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(48, 72, 48, 36)
      setBackgroundColor(Color.rgb(9, 17, 32))
    }
    val title = TextView(this).apply {
      text = "ASCEND Health Connect privacy"
      textSize = 24f; setTextColor(Color.WHITE)
    }
    val details = TextView(this).apply {
      text = "ASCEND requests read-only access to your selected steps, exercise, sleep and heart-rate data. It shows your activity summaries and never awards XP, creates goals, diagnoses illness or sends records to external AI automatically. Revoke access in Android Health Connect settings. Disconnect in ASCEND to delete its locally cached summaries."
      textSize = 16f; setTextColor(Color.LTGRAY)
      setPadding(0, 32, 0, 40)
    }
    val close = Button(this).apply { text = "Close"; setOnClickListener { finish() } }
    parent.addView(title)
    parent.addView(details)
    parent.addView(close)
    setContentView(parent)
  }
}
