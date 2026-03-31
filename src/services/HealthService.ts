import { databaseService } from "@/db/DatabaseService";
import {
  isHealthDataAvailable,
  queryQuantitySamples,
  requestAuthorization,
  saveQuantitySample,
} from "@kingstinct/react-native-healthkit";
import type {
  QuantityTypeIdentifier,
  QuantityTypeIdentifierWriteable,
  SampleTypeIdentifierWriteable,
} from "@kingstinct/react-native-healthkit";

// Heart Rate quantity type identifier from Apple HealthKit.
// Returns samples in count/s (beats per second); multiply by 60 to get BPM.
const HR_TYPE: QuantityTypeIdentifier = "HKQuantityTypeIdentifierHeartRate";
import { Platform } from "react-native";
import {
  initialize,
  readRecords,
  requestPermission,
} from "react-native-health-connect";

const SYNC_ANCHOR_KEY = "last_health_sync_timestamp";

class HealthService {
  private isAuthorized = false;

  async authorize(): Promise<boolean> {
    if (Platform.OS === "ios") {
      // Step 1: Guard — HealthKit is only available on real iOS devices (not Mac Catalyst).
      const available = isHealthDataAvailable();
      if (!available) {
        console.error(
          "[HealthService] HealthKit is not available on this device. " +
            "HealthKit is disabled on simulators and Mac Catalyst targets.",
        );
        return false;
      }

      // Step 2: Request read authorization for Heart Rate (BPM).
      // NOTE: Apple does NOT reveal read denial status (privacy), so a `true` return
      // simply means the authorization sheet was shown; we proceed and let the query fail.
      try {
        const granted = await requestAuthorization({
          // In development, request write access so we can seed mock data into the simulator.
          toShare: __DEV__
            ? ([HR_TYPE] as SampleTypeIdentifierWriteable[])
            : [],
          toRead: [HR_TYPE],
        });

        if (!granted) {
          console.warn(
            "[HealthService] iOS HealthKit authorization request failed (HealthKit unavailable).",
          );
          return false;
        }

        this.isAuthorized = true;
        return true;
      } catch (error) {
        console.error("[HealthService] iOS Authorization Error:", error);
        return false;
      }
    } else if (Platform.OS === "android") {
      try {
        const isInitialized = await initialize();
        if (!isInitialized) {
          console.error(
            "[HealthService] Health Connect SDK could not be initialized.",
          );
          return false;
        }

        // Request explicit read permission for Heart Rate on Android.
        await requestPermission([
          { accessType: "read", recordType: "HeartRate" },
        ]);

        this.isAuthorized = true;
        return true;
      } catch (e) {
        console.error(
          "[HealthService] Android initialization/permission error:",
          e,
        );
        return false;
      }
    }

    return false;
  }

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

    if (Platform.OS === "ios") {
      await this.syncHR_iOS(start, end, filterTimestamps);
    } else if (Platform.OS === "android") {
      await this.syncHR_Android(start, end, filterTimestamps);
    }
  }

  /**
   * iOS Heart Rate sync using @kingstinct/react-native-healthkit.
   * HealthKit returns HR in count/s (beats per second).
   * We multiply by 60 to convert to BPM before storing.
   */
  private async syncHR_iOS(
    since: number,
    until: number,
    filterTimestamps?: number[],
  ): Promise<void> {
    try {
      const samples = await queryQuantitySamples(HR_TYPE, {
        filter: {
          date: {
            startDate: new Date(since),
            endDate: new Date(until),
          },
        },
        ascending: true,
        limit: 0,
      });

      if (!samples || samples.length === 0) {
        return;
      }

      let latestTimestamp = since;
      let storedCount = 0;

      for (const sample of samples) {
        const ts = new Date(sample.startDate).getTime();

        // Selective filtering: only keep samples within 5s of a pivot timestamp if provided.
        const isWithinContext = filterTimestamps
          ? filterTimestamps.some((pivot) => Math.abs(ts - pivot) <= 5000)
          : true;

        if (ts > since && isWithinContext) {
          // HealthKit HR quantity is in count/s — convert to BPM.
          const bpm = Math.round(sample.quantity * 60);
          await databaseService.recordBiometric({
            timestamp: ts,
            type: "HR",
            value: bpm,
          });
          storedCount++;
        }
        if (ts > latestTimestamp) latestTimestamp = ts;
      }

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
        `[HealthService] iOS HR sync — stored ${storedCount}/${samples.length} samples.`,
      );
    } catch (error) {
      console.error(
        "[HealthService] Failed to fetch iOS Heart Rate data:",
        error,
      );
    }
  }

  /**
   * Android Heart Rate sync using react-native-health-connect.
   * HeartRate records contain an array of `samples`, each with `beatsPerMinute`.
   * We average the samples per record and store one value per timestamp.
   */
  private async syncHR_Android(
    since: number,
    until: number,
    filterTimestamps?: number[],
  ): Promise<void> {
    try {
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
        return;
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
          // Average all bpm samples within this record
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

          await databaseService.recordBiometric({
            timestamp: ts,
            type: "HR",
            value: avgBpm,
          });
          storedCount++;
        }
        if (ts > latestTimestamp) latestTimestamp = ts;
      }

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
        `[HealthService] Android HR sync — stored ${storedCount}/${result.records.length} samples.`,
      );
    } catch (error) {
      console.error("[HealthService] Android HR sync error:", error);
    }
  }

  /**
   * Seeds the iOS HealthKit store with mock Heart Rate samples manually.
   * Useful for testing the sync anchor patterns and data visualization.
   * Range: 55–90 BPM (normal resting-to-active developer range).
   */
  public async seedMockData(
    count: number = 5,
    windowMinutes: number = 60,
  ): Promise<void> {
    try {
      console.log(
        `[HealthService] Injecting ${count} mock HR samples over ${windowMinutes}m...`,
      );

      const interval = Math.floor(windowMinutes / count);

      for (let i = 0; i < count; i++) {
        const timestamp = new Date(Date.now() - i * interval * 60 * 1000);
        // Store in count/s as HealthKit expects, then convert back on read.
        // BPM range: 55–90. Divide by 60 to store as count/s.
        const bpm = Math.floor(Math.random() * (90 - 55) + 55);
        await saveQuantitySample(
          HR_TYPE as QuantityTypeIdentifierWriteable,
          "count/s",
          bpm / 60,
          timestamp,
          timestamp,
        );
      }
      console.log("[HealthService] Mock HR data injection completed.");
    } catch (error) {
      console.error("[HealthService] Failed manual injection:", error);
      throw error;
    }
  }
}

export const healthService = new HealthService();
