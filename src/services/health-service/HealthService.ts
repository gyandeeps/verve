import { BaseHealthService } from "./BaseHealthService";

/**
 * Generic implementation for non-native platforms (e.g., Web, Server-side rendering).
 */
class GenericHealthService extends BaseHealthService {
  async authorize(): Promise<boolean> {
    console.warn(
      "[HealthService] Authorization not supported on this platform.",
    );
    return false;
  }

  protected async fetchAndStoreHR(): Promise<{
    storedCount: number;
    samplesCount: number;
    latestTimestamp: number;
  }> {
    return { storedCount: 0, samplesCount: 0, latestTimestamp: 0 };
  }

  async seedMockData(): Promise<{
    count: number;
    contextTimestamps: number[];
  }> {
    console.warn(
      "[HealthService] Mock seeding not supported on this platform.",
    );
    return { count: 0, contextTimestamps: [] };
  }
}

export const healthService = new GenericHealthService();
export const isPermissionFlowActive = false;
