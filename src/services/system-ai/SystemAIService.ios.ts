import { AppleFoundationModels } from "@react-native-ai/apple";
import {
  AIConfig,
  AISystemStatus,
  BaseSystemAIService,
} from "./BaseSystemAIService";

export class SystemAIService extends BaseSystemAIService {
  constructor() {
    super();
    this.checkStatus();
  }

  async checkStatus(): Promise<AISystemStatus> {
    try {
      // @react-native-ai/apple's isAvailable returns a boolean for availability
      const isAvailable = await AppleFoundationModels.isAvailable();
      if (!isAvailable) {
        this.status = AISystemStatus.UNSUPPORTED;
        return this.status;
      }

      // Apple Intelligence doesn't report fine-grained states like "downloadable"
      // through this interface; if it's available, it's ready.
      this.status = AISystemStatus.READY;
    } catch (e) {
      console.error("[SystemAIService.ios] Status check failed:", e);
      this.status = AISystemStatus.ERROR;
    }
    return this.status;
  }

  async downloadModel(): Promise<void> {
    // Apple Intelligence models are managed by the OS (iOS 18.1+ settings)
    // There is no manual download trigger in the current native module.
    console.warn(
      "[SystemAIService.ios] Manual download not supported via native bridge. Enable Apple Intelligence in System Settings.",
    );
  }

  async executePrompt(prompt: string, config?: AIConfig): Promise<string> {
    if (this.status !== AISystemStatus.READY) {
      const currentStatus = await this.checkStatus();
      if (currentStatus !== AISystemStatus.READY) {
        throw new Error(`System AI not ready. Current status: ${this.status}`);
      }
    }

    try {
      const response = await AppleFoundationModels.generateText(
        [{ role: "user", content: prompt }],
        {
          temperature: config?.temperature ?? 0.7,
          maxTokens: config?.maxTokens ?? 512,
        },
      );

      // Extract text parts from the response segments
      return response
        .filter((part) => part.type === "text")
        .map((part) => (part as { type: "text"; text: string }).text)
        .join("");
    } catch (e: any) {
      const errorMsg = e.message || String(e);
      const isSimulatorError =
        errorMsg.includes("DecodingError") ||
        errorMsg.includes("FoundationModels") ||
        errorMsg.includes("GenerationError") ||
        errorMsg.includes("-1"); // Specific code seen in logs

      // In development, we previously returned a mock response here to unblock UI work.
      // Now we strictly throw the error to allow the AIFacade to trigger a real LLM fallback.
      if (__DEV__ && isSimulatorError) {
        console.warn(
          "[SystemAIService.ios] Simulator asset missing or decoding failed. Triggering fallback...",
        );
      }

      console.error("[SystemAIService.ios] Execution failed:", e);
      this.status = AISystemStatus.ERROR;
      throw e;
    }
  }

  async unload(): Promise<void> {
    // Unloading is handled by the OS/Bridge automatically.
    console.log("[SystemAIService.ios] Unload called (no-op).");
  }
}

export const systemAIService = new SystemAIService();
