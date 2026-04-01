import { Directory, File, Paths } from "expo-file-system";
// @ts-ignore - expo/fetch is the modern way in SDK 55 as per docs
import { fetch } from "expo/fetch";
import { initLlama, LlamaContext } from "llama.rn";
import { HCI_SYSTEM_PROMPT } from "../constants/Prompts";

const MODEL_NAME = "Llama-3.2-3B-Instruct-Q4_K_M.gguf";
const MODEL_DIR = new Directory(Paths.document, "models");
const MODEL_FILE = new File(MODEL_DIR, MODEL_NAME);

const MODEL_URL =
  "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf";

export enum AIServiceState {
  DISCONNECTED = "DISCONNECTED",
  DOWNLOADING = "DOWNLOADING",
  INITIALIZING = "INITIALIZING",
  READY = "READY",
  ERROR = "ERROR",
}

export type TelemetryEvent = {
  timestamp: number;
  app_name: string;
  window_title?: string;
  churn_rate: number;
  idle_time_sec: number;
  hr_points: number[];
};

export type AnalysisResult = {
  overall_state: "High Stress" | "Calm" | "Deep Work" | "Distracted";
  stress_triggers: string[];
  calm_periods: string[];
  churn_impact: string;
  actionable_feedback: string;
  app_categories: Record<string, string>;
};

class AIService {
  private context: LlamaContext | null = null;
  private state: AIServiceState = AIServiceState.DISCONNECTED;
  private progress: number = 0;
  private error: string | null = null;

  getState() {
    return {
      state: this.state,
      progress: this.progress,
      error: this.error,
    };
  }

  async checkModelExists(): Promise<boolean> {
    try {
      if (!MODEL_DIR.exists) {
        MODEL_DIR.create();
      }
      return MODEL_FILE.exists;
    } catch (e) {
      console.error("[AIService] File check error:", e);
      return false;
    }
  }

  async downloadModel(onProgress?: (p: number) => void): Promise<void> {
    if (this.state === AIServiceState.DOWNLOADING) return;

    this.state = AIServiceState.DOWNLOADING;
    this.progress = 0;
    this.error = null;

    try {
      console.log("[AIService] Starting download with modern fetch...");
      const response = await fetch(MODEL_URL);

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      const total = parseInt(response.headers.get("content-length") || "0", 10);
      let loaded = 0;

      if (!response.body) {
        throw new Error("Response body is not readable");
      }

      if (!MODEL_DIR.exists) {
        MODEL_DIR.create();
      }

      MODEL_FILE.create({ overwrite: true, intermediates: true });

      const handle = MODEL_FILE.open();
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          handle.writeBytes(value);
          loaded += value.length;

          if (total) {
            this.progress = loaded / total;
            onProgress?.(this.progress);
          }
        }
      }

      handle.close();
      console.log("[AIService] Model downloaded to:", MODEL_FILE.uri);
      this.state = AIServiceState.DISCONNECTED;
    } catch (e: any) {
      console.error("[AIService] Download error:", e);
      this.state = AIServiceState.ERROR;
      this.error = e.message;
      throw e;
    }
  }

  async initialize(): Promise<void> {
    if (this.context) return;

    // Allow retry after a previous error instead of looping on a broken state
    if (this.state === AIServiceState.ERROR) {
      this.state = AIServiceState.DISCONNECTED;
      this.error = null;
    }

    const exists = await this.checkModelExists();
    if (!exists) {
      throw new Error("Model not found. Please download it first.");
    }

    this.state = AIServiceState.INITIALIZING;
    try {
      console.log("[AIService] Initializing llama.rn context...");
      this.context = await initLlama({
        model: MODEL_FILE.uri,
        // n_gpu_layers: 0 — pure ARM NEON CPU inference.
        // With 1 GPU layer, Metal still compiles shaders and performs
        // CPU⇔GPU memory transfers on every forward pass, adding latency
        // without meaningful throughput gain for a single layer.
        // Pure CPU is more predictable and avoids TurboModule watchdog conflicts.
        n_gpu_layers: 0,
        // 3072 tokens: ~120 system prompt + ~10 events×30 tokens + 300 output
        // = ~730 tokens used, well under the limit.
        n_ctx: 3072,
        use_mlock: false,
      });

      this.state = AIServiceState.READY;
      console.log("[AIService] Context initialized successfully");
    } catch (e: any) {
      console.error("[AIService] Init error:", e);
      this.state = AIServiceState.ERROR;
      this.error = e.message;
      throw e;
    }
  }

  /**
   * Releases the llama context and frees native memory.
   * Call this when the AI feature is no longer in view, or on app background.
   * In dev mode, Fast Refresh tries to invalidate native modules — releasing
   * the context first prevents the TurboModuleManager timeout.
   */
  async release(): Promise<void> {
    if (this.context) {
      await this.context.release();
      this.context = null;
      this.state = AIServiceState.DISCONNECTED;
      console.log("[AIService] Context released.");
    }
  }

  async analyzeCognitiveState(
    events: TelemetryEvent[],
    onToken?: (token: string) => void,
  ): Promise<AnalysisResult> {
    if (__DEV__) {
      console.log(
        "[AIService] Note: TurboModuleManager timeout in dev is caused by " +
          "Fast Refresh firing during inference. This does not occur in production.",
      );
    }
    if (!this.context) {
      await this.initialize();
    }
    if (!this.context) throw new Error("AI context not ready");

    const prompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${HCI_SYSTEM_PROMPT}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\nAnalyze this data block:\n${JSON.stringify(events)}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`;

    const response = await this.context.completion(
      {
        prompt,
        // Compact JSON output is ~150-200 tokens. 300 gives safe headroom.
        n_predict: 300,
        temperature: 0.2, // Low for strict JSON structure
        stop: ["<|eot_id|>"],
      },
      (token) => {
        onToken?.(token.token);
      },
    );

    try {
      // Find JSON block in case of conversational prefixing
      const jsonStart = response.text.indexOf("{");
      const jsonEnd = response.text.lastIndexOf("}") + 1;
      const jsonStr = response.text.slice(jsonStart, jsonEnd);
      return JSON.parse(jsonStr);
    } catch (err) {
      console.error(
        "[AIService] JSON Parse Error in LLM Output:",
        response.text,
      );
      throw new Error("AI failed to return valid structured data");
    }
  }

  async generateSummary(
    prompt: string,
    onToken?: (token: string) => void,
  ): Promise<string> {
    if (!this.context) {
      await this.initialize();
    }
    if (!this.context) throw new Error("AI context not ready");

    const fullPrompt = `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`;

    const response = await this.context.completion(
      {
        prompt: fullPrompt,
        n_predict: 500,
        temperature: 0.7,
        stop: ["<|eot_id|>"],
      },
      (token) => {
        onToken?.(token.token);
      },
    );

    return response.text;
  }
}

export const aiService = new AIService();
