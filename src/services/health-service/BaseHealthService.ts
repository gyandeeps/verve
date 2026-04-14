import { databaseService, HeartRateSample } from "../../db/DatabaseService";

export const SYNC_ANCHOR_KEY = "last_health_sync_timestamp";

export abstract class BaseHealthService {
  protected isAuthorized = false;

  /**
   * Request platform-specific authorization for health data (HR).
   */
  abstract authorize(): Promise<boolean>;

  /**
   * Fetch Heart Rate samples for a specific time range.
   * Returns an array of samples within the [start, end] window.
   */
  abstract queryHeartRateSamples(
    start: number,
    end: number,
  ): Promise<HeartRateSample[]>;

  /**
   * Synchronizes biometric data with identified workstation telemetry.
   *
   * This is the primary engine for biometric hydration. It can be invoked surgicaly
   * with a list of timestamps (ideal for real-time stream completion) or in
   * "Catch-up" mode (default) which scans the database for telemetry records
   * lacking biometric correlation.
   *
   * Performance: This method utilizes range-based biometric queries to minimize
   * overhead on the native bridge and batch filters the results in-memory.
   */
  async syncHealthData(
    contextualTimestamps?: number[],
  ): Promise<{ storedCount: number; samplesCount: number }> {
    if (!this.isAuthorized) {
      const authorized = await this.authorize();
      if (!authorized) return { storedCount: 0, samplesCount: 0 };
    }

    const db = await databaseService.init();
    let telemetryItems: any[] = [];

    if (contextualTimestamps && contextualTimestamps.length > 0) {
      // SURGICAL SYNC: Query for specific telemetry IDs corresponding to the provided start timestamps.
      const placeholders = contextualTimestamps.map(() => "?").join(",");
      telemetryItems = await db.getAllAsync<any>(
        `SELECT id, start_timestamp, end_timestamp FROM telemetry WHERE start_timestamp IN (${placeholders})`,
        contextualTimestamps,
      );
    } else {
      // CATCH-UP SYNC: Scan for any telemetry records in the last 24 hours that lack HR data.
      const startTime = Date.now() - 24 * 60 * 60 * 1000;
      telemetryItems = await db.getAllAsync<any>(
        `SELECT id, start_timestamp, end_timestamp FROM telemetry 
         WHERE start_timestamp >= ? 
         AND NOT EXISTS (SELECT 1 FROM hr_samples WHERE telemetry_id = telemetry.id)
         ORDER BY start_timestamp ASC`,
        [startTime],
      );
    }

    if (telemetryItems.length === 0) {
      return { storedCount: 0, samplesCount: 0 };
    }

    // Determine the total time range across all telemetry items for a single batch query.
    const minTs = Math.min(...telemetryItems.map((t) => t.start_timestamp));
    const maxTs = Math.max(...telemetryItems.map((t) => t.end_timestamp));

    console.log(
      `[HealthService] Syncing biometrics for ${telemetryItems.length} events across ${Math.round(
        (maxTs - minTs) / 60000,
      )} min range.`,
    );

    // Fetch ALL HR samples in one go for the entire range.
    const allSamples = await this.queryHeartRateSamples(minTs, maxTs);

    let storedCount = 0;
    let samplesCount = 0;

    for (const item of telemetryItems) {
      const windowStart = item.start_timestamp;
      const windowEnd = item.end_timestamp;

      // Filter in-memory to match this telemetry's exact window.
      const sessionSamples = allSamples.filter(
        (s) => s.ts >= windowStart && s.ts < windowEnd,
      );

      if (sessionSamples.length > 0) {
        await databaseService.recordHeartRateSamples(item.id, sessionSamples);
        storedCount++;
        samplesCount += sessionSamples.length;
      }
    }

    // Update the sync anchor to the latest telemetry processed to help UI state.
    const latestTs = telemetryItems[telemetryItems.length - 1].start_timestamp;
    await databaseService.setMetadata(SYNC_ANCHOR_KEY, latestTs.toString());

    return { storedCount, samplesCount };
  }

  /**
   * Retrieves the timestamp of the last successful health sync from local metadata.
   */
  async getLastSyncTimestamp(): Promise<number | null> {
    const val = await databaseService.getMetadata(SYNC_ANCHOR_KEY);
    return val ? parseInt(val, 10) : null;
  }

  /**
   * Seeds the health store with mock Heart Rate samples.
   */
  abstract seedMockData(
    count?: number,
    windowMinutes?: number,
  ): Promise<{ count: number; contextTimestamps: number[] }>;
}
