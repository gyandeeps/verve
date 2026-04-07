import { Directory, File, Paths } from "expo-file-system";
// @ts-ignore - expo/fetch is the modern way in SDK 55 as per docs
import { fetch } from "expo/fetch";
import { initLlama, LlamaContext } from "llama.rn";
import {
  AIModel,
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
} from "../constants/Models";
import { HCI_SYSTEM_PROMPT } from "../constants/Prompts";
import { databaseService } from "../db/DatabaseService";

const MODEL_DIR = new Directory(Paths.document, "models");
const SIZE_BUFFER = 0.1; // 10% threshold for "significantly smaller" check

export enum AIServiceState {
  DISCONNECTED = "DISCONNECTED",
  DOWNLOADING = "DOWNLOADING",
  INITIALIZING = "INITIALIZING",
  READY = "READY",
  ERROR = "ERROR",
}

export type TelemetryEvent = {
  start_timestamp: number;
  end_timestamp: number;
  machine_name: string;
  churn_rate: number;
  idle_timer: number;
  sessions_data: { app: string; title: string; duration_sec: number }[];
  hr_samples: { ts: number; bpm: number }[];
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
  private selectedModelId: string | null = null;

  constructor() {
    this.loadSelectedModel();
  }

  get currentModel(): AIModel | null {
    if (!this.selectedModelId) return null;
    return AVAILABLE_MODELS.find((m) => m.id === this.selectedModelId) || null;
  }

  private async loadSelectedModel() {
    try {
      const savedId = await databaseService.getMetadata("selected_model_id");
      this.selectedModelId = savedId || DEFAULT_MODEL_ID;
    } catch (e) {
      this.selectedModelId = DEFAULT_MODEL_ID;
    }
  }

  async getSelectedModel(): Promise<AIModel> {
    if (!this.selectedModelId) {
      await this.loadSelectedModel();
    }
    return (
      AVAILABLE_MODELS.find((m) => m.id === this.selectedModelId) ||
      AVAILABLE_MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!
    );
  }

  async setSelectedModel(id: string): Promise<void> {
    const model = AVAILABLE_MODELS.find((m) => m.id === id);
    if (!model) throw new Error("Invalid model ID");

    if (this.context) {
      await this.release();
    }

    this.selectedModelId = id;
    await databaseService.setMetadata("selected_model_id", id);
    this.state = AIServiceState.DISCONNECTED;
  }

  private getModelFile(model: AIModel): File {
    return new File(MODEL_DIR, model.filename);
  }

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
      const model = await this.getSelectedModel();
      const modelFile = this.getModelFile(model);

      if (!modelFile.exists) return false;

      const size = modelFile.size;
      console.log(
        `[AIService] Model file size check: ${size} bytes (Expected: ${model.sizeBytes})`,
      );

      return size >= model.sizeBytes * (1 - SIZE_BUFFER);
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
      const model = await this.getSelectedModel();
      const modelFile = this.getModelFile(model);

      console.log("[AIService] Pre-flight check: Validating storage space...");
      const freeStorage = Paths.availableDiskSpace;
      const freeGB = freeStorage / (1024 * 1024 * 1024);
      const requiredGB = model.sizeBytes / (1024 * 1024 * 1024);

      console.log(
        `[AIService] Free space: ${freeGB.toFixed(2)} GB, Required: ${requiredGB.toFixed(2)} GB`,
      );

      if (freeStorage < model.sizeBytes) {
        throw new Error(
          `Insufficient storage. You need at least ${requiredGB.toFixed(
            2,
          )} GB free, but only ${freeGB.toFixed(2)} GB is available.`,
        );
      }

      console.log("[AIService] Starting download with modern fetch...");
      const response = await fetch(model.url);

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

      modelFile.create({ overwrite: true, intermediates: true });

      const handle = modelFile.open();
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
      console.log("[AIService] Model downloaded to:", modelFile.uri);
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

    if (this.state === AIServiceState.ERROR) {
      this.state = AIServiceState.DISCONNECTED;
      this.error = null;
    }

    const exists = await this.checkModelExists();
    if (!exists) {
      throw new Error("Model not found. Please download it first.");
    }

    const model = await this.getSelectedModel();
    const modelFile = this.getModelFile(model);

    this.state = AIServiceState.INITIALIZING;
    try {
      console.log("[AIService] Initializing llama.rn context...");
      this.context = await initLlama({
        model: modelFile.uri,
        n_gpu_layers: 0,
        n_ctx: 3072,
        use_mlock: false,
        use_mmap: false, // Prevents "unable to load model" caused by mmap limitations on older Android devices (e.g. Android 10)
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

  async deleteModel(): Promise<void> {
    try {
      if (this.context) {
        await this.release();
      }
      const model = await this.getSelectedModel();
      const modelFile = this.getModelFile(model);

      if (modelFile.exists) {
        modelFile.delete();
        console.log("[AIService] Model file deleted.");
      }
      this.state = AIServiceState.DISCONNECTED;
      this.error = null;
      this.progress = 0;
    } catch (e: any) {
      console.error("[AIService] Error deleting model:", e);
      throw e;
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

    const prompt = `<|system|>${HCI_SYSTEM_PROMPT}<|end|><|user|>Analyze this data block:\n${JSON.stringify(events)}<|end|><|assistant|>`;

    const response = await this.context.completion(
      {
        prompt,
        n_predict: 512,
        temperature: 0.1,
        stop: ["<|end|>"],
      },
      (token) => {
        onToken?.(token.token);
      },
    );

    try {
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

    const fullPrompt = `<|system|>You are a helpful assistant.<|end|><|user|>${prompt}<|end|><|assistant|>`;

    const response = await this.context.completion(
      {
        prompt: fullPrompt,
        n_predict: 500,
        temperature: 0.7,
        stop: ["<|end|>"],
      },
      (token) => {
        onToken?.(token.token);
      },
    );

    return response.text;
  }
}

export const aiService = new AIService();
