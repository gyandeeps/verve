export enum AISystemStatus {
  READY = "ready",
  DOWNLOADING = "downloading",
  DOWNLOADABLE = "downloadable",
  UNSUPPORTED = "unsupported",
  ERROR = "error",
}

export type AIConfig = {
  temperature?: number;
  maxTokens?: number;
};

export abstract class BaseSystemAIService {
  protected status: AISystemStatus = AISystemStatus.UNSUPPORTED;

  abstract checkStatus(): Promise<AISystemStatus>;
  abstract downloadModel(): Promise<void>;
  abstract executePrompt(prompt: string, config?: AIConfig): Promise<string>;
  abstract unload(): Promise<void>;

  public getStatus(): AISystemStatus {
    return this.status;
  }

  protected mapNativeStatus(nativeStatus: string): AISystemStatus {
    switch (nativeStatus) {
      case "ready":
      case "available":
        return AISystemStatus.READY;
      case "downloading":
        return AISystemStatus.DOWNLOADING;
      case "not_downloaded":
      case "downloadable":
        return AISystemStatus.DOWNLOADABLE;
      default:
        return AISystemStatus.UNSUPPORTED;
    }
  }

  public async generateMedicalSummary(events: any[]): Promise<string> {
    const clinicalPrompt = `
      You are a Senior Clinical Analyst. Analyze the following telemetry window:
      ${JSON.stringify(events)}
      
      Provide a concise medical summary focusing on:
      1. Overall cognitive load trend.
      2. Significant physiological spikes and their correlated app context.
      3. Actionable recovery recommendation.
    `;

    return this.executePrompt(clinicalPrompt, {
      temperature: 0.2,
      maxTokens: 1024,
    });
  }
}
