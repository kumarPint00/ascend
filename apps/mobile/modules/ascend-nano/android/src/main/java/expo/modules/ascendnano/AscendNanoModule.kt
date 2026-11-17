package expo.modules.ascendnano

import android.os.Build
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.DownloadStatus
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

    AsyncFunction("status") Coroutine {
      if (Build.VERSION.SDK_INT < 26) return@Coroutine "unsupported"
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

    AsyncFunction("download") Coroutine {
      if (Build.VERSION.SDK_INT < 26) return@Coroutine false
      val model = Generation.getClient()
      if (model.checkStatus() == FeatureStatus.AVAILABLE) return@Coroutine true
      if (model.checkStatus() != FeatureStatus.DOWNLOADABLE &&
          model.checkStatus() != FeatureStatus.DOWNLOADING)
        return@Coroutine false
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
