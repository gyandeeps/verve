import { BaseSystemAIService } from "./BaseSystemAIService";

/**
 * Platform-agnostic interface for SystemAIService.
 * TypeScript uses this declaration, while Metro resolves to
 * SystemAIService.ios.ts or SystemAIService.android.ts at build time.
 */
export const systemAIService: BaseSystemAIService;
