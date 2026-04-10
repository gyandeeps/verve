import { databaseService } from "../db/DatabaseService";
import {
  aiService,
  AIServiceState,
  AnalysisResult,
  TelemetryEvent,
} from "./AIService";
import { systemAIService, AISystemStatus, AIConfig } from "./system-ai";
import { PROMPT_CONFIGS, DEFAULT_PROMPT_ID } from "../constants/Prompts";

export type AIEngine = "system" | "local";

class AIFacade {
  private preferredEngine: AIEngine | null = null;
  private forceSystemAI: boolean = false;
  private initialized: boolean = false;

  async initialize() {
    if (this.initialized) return;

    const [savedEngine, savedForce] = await Promise.all([
      databaseService.getMetadata("preferred_ai_engine"),
      databaseService.getMetadata("force_system_ai"),
    ]);

    this.forceSystemAI = savedForce === "true";

    if (savedEngine) {
      this.preferredEngine = savedEngine as AIEngine;
    } else {
      // First launch evaluation
      const status = await systemAIService.checkStatus();
      if (status !== AISystemStatus.UNSUPPORTED) {
        this.preferredEngine = "system";
      } else {
        this.preferredEngine = "local";
      }
      await databaseService.setMetadata(
        "preferred_ai_engine",
        this.preferredEngine,
      );
    }

    this.initialized = true;
    console.log(
      `[AIFacade] Initialized. Preferred: ${this.preferredEngine}, Force System: ${this.forceSystemAI}`,
    );
  }

  async getPreferredEngine(): Promise<AIEngine> {
    if (!this.initialized) await this.initialize();
    return this.preferredEngine || "local";
  }

  async setPreferredEngine(engine: AIEngine) {
    this.preferredEngine = engine;
    await databaseService.setMetadata("preferred_ai_engine", engine);
  }

  async isForceSystemAI(): Promise<boolean> {
    if (!this.initialized) await this.initialize();
    return this.forceSystemAI;
  }

  async setForceSystemAI(force: boolean) {
    this.forceSystemAI = force;
    await databaseService.setMetadata(
      "force_system_ai",
      force ? "true" : "false",
    );
  }

  /**
   * Returns which engine will actually be used for the next request
   */
  async getActiveEngine(): Promise<AIEngine> {
    if (!this.initialized) await this.initialize();
    if (this.forceSystemAI) return "system";
    return this.preferredEngine || "local";
  }

  async analyzeCognitiveState(
    events: TelemetryEvent[],
    promptId: string = DEFAULT_PROMPT_ID,
    onToken?: (token: string) => void,
  ): Promise<AnalysisResult> {
    const activeEngine = await this.getActiveEngine();

    if (activeEngine === "system") {
      try {
        const status = await systemAIService.checkStatus();
        if (status === AISystemStatus.READY) {
          return await this.runSystemInference(events, promptId);
        }
        // If not ready (needs download), fall back to local if preferred engine is system but not forced
        if (this.forceSystemAI) {
          throw new Error(
            "System AI is forced but not ready. Please download the model in Settings.",
          );
        }
      } catch (e) {
        console.error(
          "[AIFacade] System AI failed, falling back to Local LLM:",
          e,
        );
        if (this.forceSystemAI) throw e;
      }
    }

    // Fallback to local
    return await aiService.analyzeCognitiveState(events, promptId, onToken);
  }

  private async runSystemInference(
    events: TelemetryEvent[],
    promptId: string,
  ): Promise<AnalysisResult> {
    const config =
      PROMPT_CONFIGS[promptId] || PROMPT_CONFIGS[DEFAULT_PROMPT_ID];

    // Construct a specialized prompt for the system AI to ensure JSON output
    const prompt = `
      ${config.systemPrompt}
      
      DATA TO ANALYZE:
      ${JSON.stringify(events)}
      
      REMINDER: Output ONLY the raw JSON object matching the schema above. No markdown, no preamble.
    `;

    const response = await systemAIService.executePrompt(prompt, {
      temperature: 0.1,
    });

    try {
      // Basic JSON cleaning in case of markdown blocks or preamble
      const jsonStart = response.indexOf("{");
      const jsonEnd = response.lastIndexOf("}") + 1;

      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error("No JSON bracket found in response");
      }

      const jsonStr = response.slice(jsonStart, jsonEnd);
      return JSON.parse(jsonStr);
    } catch (err) {
      console.warn(
        "[AIFacade] System AI failed to provide JSON. Response was conversational or simulated.",
      );
      throw new Error(
        `System AI failed to return valid structured data: ${err}`,
      );
    }
  }

  /**
   * Unified status for UI components
   */
  async getUnifiedStatus() {
    const activeEngine = await this.getActiveEngine();
    const localState = aiService.getState();
    const systemStatus = systemAIService.getStatus();

    return {
      activeEngine,
      local: localState,
      system: systemStatus,
    };
  }
}

export const aiFacade = new AIFacade();
