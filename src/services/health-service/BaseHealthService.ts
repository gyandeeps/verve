import { databaseService } from "../../db/DatabaseService";

export const SYNC_ANCHOR_KEY = "last_health_sync_timestamp";

export abstract class BaseHealthService {
  protected isAuthorized = false;

  /**
   * Request platform-specific authorization for health data (HR).
   */
  abstract authorize(): Promise<boolean>;

  /**
   * Fetch and store Heart Rate sync logic for the specific platform.
   */
  protected abstract fetchAndStoreHR(
    since: number,
    until: number,
    filterTimestamps?: number[],
  ): Promise<{
    storedCount: number;
    samplesCount: number;
    latestTimestamp: number;
  }>;

  /**
   * Orchestrate the sync logic using the Sync Anchor Pattern.
   */
  async syncHealthData(
    startTime?: number,
    endTime?: number,
    filterTimestamps?: number[],
  ) {
    if (!this.isAuthorized) {
      const authorized = await this.authorize();
      if (!authorized) return;
    }

    let start = startTime;
    let end = endTime || Date.now();

    // STRICT CONTEXTUAL SYNC: We only want to sync when we have specific workstation events
    // to correlate with. If filterTimestamps is missing or empty, skip the sync process.
    if (!filterTimestamps || filterTimestamps.length === 0) {
      console.log(
        "[HealthService] Sync bypassed: No workstation context provided.",
      );
      return;
    }

    // If no window is provided, fallback to the Sync Anchor Pattern.
    if (start === undefined) {
      const lastSyncStr = await databaseService.getMetadata(SYNC_ANCHOR_KEY);
      start = lastSyncStr
        ? parseInt(lastSyncStr, 10)
        : Date.now() - 24 * 60 * 60 * 1000;
    } else {
      // Per user request: apply 5s buffer (narrow window) around the telemetry event(s).
      start = start - 5000;
      end = end + 5000;
    }

    try {
      const { storedCount, samplesCount, latestTimestamp } =
        await this.fetchAndStoreHR(start, end, filterTimestamps);

      if (samplesCount > 0) {
        const currentAnchorStr =
          await databaseService.getMetadata(SYNC_ANCHOR_KEY);
        const currentAnchor = currentAnchorStr
          ? parseInt(currentAnchorStr, 10)
          : 0;

        if (latestTimestamp > currentAnchor) {
          await databaseService.setMetadata(
            SYNC_ANCHOR_KEY,
            latestTimestamp.toString(),
          );
        }
        console.log(
          `[HealthService] Sync — stored ${storedCount}/${samplesCount} samples.`,
        );
      }
    } catch (error) {
      console.error("[HealthService] Sync error:", error);
    }
  }

  /**
   * Helper to write biometric data to the local SQLite database.
   */
  protected async recordHeartRate(timestamp: number, bpm: number) {
    await databaseService.recordBiometric({
      timestamp,
      type: "HR",
      value: bpm,
    });
  }

  /**
   * Seeds the health store with mock Heart Rate samples.
   */
  abstract seedMockData(
    count?: number,
    windowMinutes?: number,
  ): Promise<number>;
}
