import {
  initialize,
  readRecords,
  requestPermission,
} from "react-native-health-connect";
import { BaseHealthService } from "./BaseHealthService";

class HealthServiceAndroid extends BaseHealthService {
  async authorize(): Promise<boolean> {
    try {
      console.log("[HealthService] Initializing Health Connect...");
      const isInitialized = await initialize();

      if (!isInitialized) {
        console.error(
          "[HealthService] Health Connect SDK could not be initialized. Verify Health Connect app is installed and configured.",
        );
        return false;
      }

      console.log("[HealthService] Requesting HeartRate permissions...");
      const grantedPermissions = await requestPermission([
        { accessType: "read", recordType: "HeartRate" },
      ]);

      // Note: requestPermission returns the list of permissions granted.
      // We check if it's non-empty or contains our required type.
      const hasHeartRate = grantedPermissions.some(
        (p) => p.recordType === "HeartRate",
      );

      if (hasHeartRate) {
        console.log("[HealthService] HeartRate permission granted.");
        this.isAuthorized = true;
        return true;
      } else {
        console.warn("[HealthService] HeartRate permission denied by user.");
        return false;
      }
    } catch (e) {
      console.error(
        "[HealthService] Android initialization/permission error:",
        e,
      );
      return false;
    }
  }

  protected async fetchAndStoreHR(
    since: number,
    until: number,
    filterTimestamps?: number[],
  ): Promise<{
    storedCount: number;
    samplesCount: number;
    latestTimestamp: number;
  }> {
    const startTime = new Date(since).toISOString();
    const endTime = new Date(until).toISOString();

    const result = await readRecords("HeartRate", {
      timeRangeFilter: {
        operator: "between",
        startTime,
        endTime,
      },
    });

    if (!result.records || result.records.length === 0) {
      return { storedCount: 0, samplesCount: 0, latestTimestamp: since };
    }

    let latestTimestamp = since;
    let storedCount = 0;

    for (const record of result.records) {
      const tsStr =
        record.metadata?.lastModifiedTime ||
        (record as any).startTime ||
        (record as any).time;
      const ts = tsStr ? new Date(tsStr).getTime() : Date.now();

      const isWithinContext = filterTimestamps
        ? filterTimestamps.some((pivot) => Math.abs(ts - pivot) <= 5000)
        : true;

      if (ts > since && isWithinContext) {
        const samples = (record as any).samples ?? [];
        const avgBpm =
          samples.length > 0
            ? Math.round(
                samples.reduce(
                  (acc: number, s: any) => acc + s.beatsPerMinute,
                  0,
                ) / samples.length,
              )
            : ((record as any).beatsPerMinute ?? 0);

        await this.recordHeartRate(ts, avgBpm);
        storedCount++;
      }
      if (ts > latestTimestamp) latestTimestamp = ts;
    }

    return {
      storedCount,
      samplesCount: result.records.length,
      latestTimestamp,
    };
  }

  public async seedMockData(): Promise<number> {
    console.warn("[HealthService] Android mock data seeding not implemented.");
    return 0;
  }
}

export const healthService = new HealthServiceAndroid();
