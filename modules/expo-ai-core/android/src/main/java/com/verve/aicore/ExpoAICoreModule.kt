package com.verve.aicore

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.GenerationConfig
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.flow.collect

class AIConfig : Record {
  @Field var temperature: Float = 0.2f
  @Field var maxTokens: Int = 1024
}

/**
 * On-Device AI Module for Verve.
 * Bridges Android AICore / Gemini Nano using the ML Kit GenAI SDK.
 */
class ExpoAICoreModule : Module() {
  private var generativeModel: GenerativeModel? = null
  private var lastConfig: AIConfig? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoAICore")

    AsyncFunction("isAvailableAsync") {
      runBlocking {
        try {
          val status = Generation.getClient().checkStatus()
          when (status) {
            FeatureStatus.AVAILABLE -> "ready"
            FeatureStatus.DOWNLOADING -> "downloading"
            FeatureStatus.DOWNLOADABLE -> "downloadable"
            else -> "unsupported"
          }
        } catch (e: Exception) {
          "unsupported"
        }
      }
    }

    AsyncFunction("downloadModelAsync") {
      runBlocking {
        Generation.getClient().download().collect { }
      }
    }

    AsyncFunction("generateResponseAsync") { prompt: String, config: AIConfig ->
      runBlocking {
        if (generativeModel == null || lastConfig?.temperature != config.temperature || lastConfig?.maxTokens != config.maxTokens) {
          generativeModel = Generation.getClient()
          lastConfig = config
        }

        try {
          val result = generativeModel!!.generateContent(prompt)
          if (result.candidates == null || result.candidates.isEmpty()) "Local model failed to generate text output." else result.candidates[0].text ?: "Local model failed to generate text output."
        } catch (e: Exception) {
          "Inference Error: ${e.localizedMessage}"
        }
      }
    }

    AsyncFunction("unloadModelAsync") {
      generativeModel = null
      lastConfig = null
    }
  }
}
