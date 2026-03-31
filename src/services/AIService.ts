import { Directory, File, Paths } from "expo-file-system";
// @ts-ignore - expo/fetch is the modern way in SDK 55 as per docs
import { fetch } from "expo/fetch";
import { initLlama, LlamaContext } from "llama.rn";

const MODEL_NAME = "gemma-2-2b-it-q4_k_m.gguf";
const MODEL_DIR = new Directory(Paths.document, "models");
const MODEL_FILE = new File(MODEL_DIR, MODEL_NAME);

// Public link to a commonly used Gemma 2 2B GGUF for testing
const MODEL_URL =
  "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf";

export enum AIServiceState {
  DISCONNECTED = "DISCONNECTED",
  DOWNLOADING = "DOWNLOADING",
  INITIALIZING = "INITIALIZING",
  READY = "READY",
  ERROR = "ERROR",
}

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
      // Modern download using fetch + ReadableStream for progress
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

      // Ensure directory exists
      if (!MODEL_DIR.exists) {
        MODEL_DIR.create();
      }

      // Ensure file exists/is empty before opening handle, and create directories if needed
      MODEL_FILE.create({ overwrite: true, intermediates: true });

      // Use FileHandle for high-performance chunked writing
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
      this.state = AIServiceState.DISCONNECTED; // Ready for initialization
    } catch (e: any) {
      console.error("[AIService] Download error:", e);
      this.state = AIServiceState.ERROR;
      this.error = e.message;
      throw e;
    }
  }

  async initialize(): Promise<void> {
    if (this.context) return;

    const exists = await this.checkModelExists();
    if (!exists) {
      throw new Error("Model not found. Please download it first.");
    }

    this.state = AIServiceState.INITIALIZING;
    try {
      console.log("[AIService] Initializing llama.rn context...");
      // Use MODEL_FILE.uri for native module
      this.context = await initLlama({
        model: MODEL_FILE.uri,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: 99,
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

  async generateSummary(
    prompt: string,
    onToken?: (token: string) => void,
  ): Promise<string> {
    if (!this.context) {
      await this.initialize();
    }
    if (!this.context) throw new Error("AI context not ready");

    const response = await this.context.completion(
      {
        prompt: `user: ${prompt}\nassistant:`,
        n_predict: 200,
        temperature: 0.5,
        top_k: 40,
      },
      (token) => {
        onToken?.(token.token);
      },
    );

    return response.text;
  }
}

export const aiService = new AIService();
