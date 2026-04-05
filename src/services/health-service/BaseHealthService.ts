import { databaseService } from "../../db/DatabaseService";

export const SYNC_ANCHOR_KEY = "last_health_sync_timestamp";

export type SyncResult = {
  storedCount: number;
  samplesCount: number;
  latestTimestamp: number;
};

export abstract class BaseHealthService {
  protected isAuthorized = false;

  /**
   * Returns the last successful sync anchor (ms) or null.
   */
  async getLastSyncTimestamp(): Promise<number | null> {
    const lastSyncStr = await databaseService.getMetadata(SYNC_ANCHOR_KEY);
    return lastSyncStr ? parseInt(lastSyncStr, 10) : null;
  }

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
  ): Promise<SyncResult>;

  /**
   * Orchestrate the sync logic using the Sync Anchor Pattern.
   */
  async syncHealthData(
    startTime?: number,
    endTime?: number,
    filterTimestamps?: number[],
  ): Promise<SyncResult> {
    const emptyResult = { storedCount: 0, samplesCount: 0, latestTimestamp: 0 };

    if (!this.isAuthorized) {
      const authorized = await this.authorize();
      if (!authorized) return emptyResult;
    }

    let start = startTime;
    let end = endTime || Date.now();

    // STRICT CONTEXTUAL SYNC: We only want to sync when we have specific workstation events
    // to correlate with. If filterTimestamps is missing or empty, skip the sync process.
    if (!filterTimestamps || filterTimestamps.length === 0) {
      console.log(
        "[HealthService] Sync bypassed: No workstation context provided.",
      );
      return emptyResult;
    }

    // If no window is provided, fallback to the Sync Anchor Pattern.
    if (start === undefined) {
      const lastSync = await this.getLastSyncTimestamp();
      start = lastSync ?? Date.now() - 24 * 60 * 60 * 1000;
    } else {
      // Per user request: apply 5s buffer (narrow window) around the telemetry event(s).
      start = start - 5000;
      end = end + 5000;
    }

    try {
      const result = await this.fetchAndStoreHR(start, end, filterTimestamps);

      if (result.samplesCount > 0) {
        const currentAnchor = (await this.getLastSyncTimestamp()) || 0;

        if (result.latestTimestamp > currentAnchor) {
          await databaseService.setMetadata(
            SYNC_ANCHOR_KEY,
            result.latestTimestamp.toString(),
          );
        }
        console.log(
          `[HealthService] Sync — stored ${result.storedCount}/${result.samplesCount} samples.`,
        );
      }
      return result;
    } catch (error) {
      console.error("[HealthService] Sync error:", error);
      return emptyResult;
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
   * Returns the number of records injected and the timestamps of the telemetry
   * context used for seeding (to facilitate immediate sync-back).
   */
  abstract seedMockData(
    count?: number,
    windowMinutes?: number,
  ): Promise<{ count: number; contextTimestamps: number[] }>;

  /**
   * Catch-up on health data for recent workstation telemetry that might have
   * been delayed by OS health store propagation (often 10-15+ mins).
   * Scans recent telemetry and attempts to re-sync biometrics.
   */
  async catchUpSync(windowMinutes: number = 120): Promise<SyncResult> {
    const emptyResult = { storedCount: 0, samplesCount: 0, latestTimestamp: 0 };
    const startTime = Date.now() - windowMinutes * 60 * 1000;

    // Per user request: Be smart. Only fetch context for telemetry that
    // doesn't already have an associated HR biometric record.
    const telemetryItems =
      await databaseService.getTelemetryWithoutBiometricsInRange(
        startTime,
        Date.now(),
      );

    if (telemetryItems.length === 0) {
      console.log(
        "[HealthService] Catch-up skipped: All telemetry already has associated HR data.",
      );
      return emptyResult;
    }

    const contextTimestamps = telemetryItems.map((item) => item.timestamp);
    const minTs = Math.min(...contextTimestamps);
    const maxTs = Math.max(...contextTimestamps);

    console.log(
      `[HealthService] Catch-up syncing for ${telemetryItems.length} contextual events.`,
    );
    return await this.syncHealthData(minTs, maxTs, contextTimestamps);
  }
}
