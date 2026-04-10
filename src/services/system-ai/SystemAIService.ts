import {
  BaseSystemAIService,
  AISystemStatus,
  AIConfig,
} from "./BaseSystemAIService";

/**
 * Fallback implementation for unsupported platforms.
 */
export class SystemAIService extends BaseSystemAIService {
  constructor() {
    super();
    this.status = AISystemStatus.UNSUPPORTED;
  }

  async checkStatus(): Promise<AISystemStatus> {
    return AISystemStatus.UNSUPPORTED;
  }

  async downloadModel(): Promise<void> {
    throw new Error("System AI is not supported on this platform.");
  }

  async executePrompt(prompt: string, config?: AIConfig): Promise<string> {
    throw new Error("System AI is not supported on this platform.");
  }

  async unload(): Promise<void> {
    // No-op
  }
}

export const systemAIService = new SystemAIService();
