package expo.modules.ascendnano

import android.os.Build
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.prompt.Generation
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Coroutine
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.withTimeout

/**
 * On-device Gemini Nano bridge. Never contacts a hosted LLM.
 * No implicit model download; no prompt generation without foreground consent.
 */
class AscendNanoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AscendNano")

    // Explicit zero-argument suspend function types avoid an overload ambiguity
    // in Expo Modules Kotlin Coroutine DSL for no-parameter async functions.
    val statusHandler: suspend () -> String = {
      if (Build.VERSION.SDK_INT < 26) {
        "unsupported"
      } else {
        try {
          val model = Generation.getClient()
          when (model.checkStatus()) {
            FeatureStatus.AVAILABLE -> "available"
            FeatureStatus.DOWNLOADABLE -> "downloadable"
            FeatureStatus.DOWNLOADING -> "downloading"
            else -> "unavailable"
          }
        } catch (_: Exception) {
          "unavailable"
        }
      }
    }
    AsyncFunction("status") Coroutine statusHandler

    val downloadHandler: suspend () -> Boolean = {
      if (Build.VERSION.SDK_INT < 26) {
        false
      } else {
        val model = Generation.getClient()
        val initialStatus = model.checkStatus()
        if (initialStatus == FeatureStatus.AVAILABLE) {
          true
        } else if (initialStatus != FeatureStatus.DOWNLOADABLE &&
                   initialStatus != FeatureStatus.DOWNLOADING) {
          false
        } else {
          var ready = false
          withTimeout(120000L) {
            model.download().collect { state ->
              if (state == DownloadStatus.DownloadCompleted) ready = true
              if (state is DownloadStatus.DownloadFailed)
                throw IllegalStateException("Model download not available")
            }
          }
          ready || model.checkStatus() == FeatureStatus.AVAILABLE
        }
      }
    }
    AsyncFunction("download") Coroutine downloadHandler

    AsyncFunction("generate") Coroutine { prompt: String ->
      require(prompt.length in 1..2800) { "Prompt must be under 2800 characters" }
      if (Build.VERSION.SDK_INT < 26) throw IllegalStateException("Android 8+ required")
      val model = Generation.getClient()
      if (model.checkStatus() != FeatureStatus.AVAILABLE)
        throw IllegalStateException("Gemini Nano is not available on this device yet")
      val response = withTimeout(25000L) { model.generateContent(prompt) }
      val text = response.candidates.firstOrNull()?.text ?: ""
      if (text.isBlank()) throw IllegalStateException("No valid text generated")
      text.take(3500)
    }
  }
}
