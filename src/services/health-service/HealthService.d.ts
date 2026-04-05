import { BaseHealthService } from "./BaseHealthService";

/**
 * Platform-agnostic interface for HealthService.
 * TypeScript uses this declaration, while Metro resolves to
 * HealthService.ios.ts or HealthService.android.ts at build time.
 */
export const healthService: BaseHealthService;
export const isPermissionFlowActive: boolean;
