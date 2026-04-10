import ExpoAICore from "expo-ai-core";
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
      const availability = await ExpoAICore.isAvailableAsync();
      if (availability === "unsupported") {
        this.status = AISystemStatus.UNSUPPORTED;
      } else {
        this.status = this.mapNativeStatus(availability);
      }
    } catch (e) {
      console.error("[SystemAIService.android] Status check failed:", e);
      this.status = AISystemStatus.ERROR;
    }
    return this.status;
  }

  async downloadModel(): Promise<void> {
    if (this.status !== AISystemStatus.DOWNLOADABLE) return;

    this.status = AISystemStatus.DOWNLOADING;
    try {
      await ExpoAICore.downloadModelAsync();
      await this.checkStatus();
    } catch (e) {
      this.status = AISystemStatus.ERROR;
      throw e;
    }
  }

  async executePrompt(prompt: string, config?: AIConfig): Promise<string> {
    if (this.status !== AISystemStatus.READY) {
      throw new Error(`System AI not ready. Current status: ${this.status}`);
    }

    return await ExpoAICore.generateResponseAsync(prompt, {
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 512,
    });
  }

  async unload(): Promise<void> {
    try {
      await ExpoAICore.unloadModelAsync();
      this.status = AISystemStatus.DOWNLOADABLE;
    } catch (e) {
      console.error("[SystemAIService.android] Failed to unload model:", e);
    }
  }
}

export const systemAIService = new SystemAIService();
