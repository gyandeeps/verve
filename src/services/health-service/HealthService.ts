import { BaseHealthService } from "./BaseHealthService";
import { HeartRateSample } from "../../db/DatabaseService";

class GenericHealthService extends BaseHealthService {
  async authorize(): Promise<boolean> {
    console.warn(
      "[HealthService] Authorization not supported on this platform.",
    );
    return false;
  }

  async queryHeartRateSamples(
    start: number,
    end: number,
  ): Promise<HeartRateSample[]> {
    return [];
  }

  async seedMockData(
    count?: number,
    windowMinutes?: number,
  ): Promise<{ count: number; contextTimestamps: number[] }> {
    console.warn(
      "[HealthService] Mock seeding not supported on this platform.",
    );
    return { count: 0, contextTimestamps: [] };
  }
}

export const healthService = new GenericHealthService();
export const isPermissionFlowActive = false;
