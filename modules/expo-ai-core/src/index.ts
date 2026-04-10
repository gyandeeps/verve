import { requireNativeModule, NativeModule } from "expo-modules-core";

export type AIConfig = {
  temperature: number;
  maxTokens: number;
};

export declare class ExpoAICoreModule extends NativeModule {
  isAvailableAsync(): Promise<string>;
  downloadModelAsync(): Promise<void>;
  generateResponseAsync(prompt: string, config: AIConfig): Promise<string>;
  unloadModelAsync(): Promise<void>;
}

// Loads the native module "ExpoAICore"
const ExpoAICore = requireNativeModule<ExpoAICoreModule>("ExpoAICore");

export default ExpoAICore;
