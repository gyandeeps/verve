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

// The HRV SDNN quantity type identifier string constant from Apple HealthKit.
const HRV_SDNN_TYPE: QuantityTypeIdentifier =
  "HKQuantityTypeIdentifierHeartRateVariabilitySDNN";
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
      // isHealthDataAvailable() is synchronous — no await needed.
      const available = isHealthDataAvailable();
      if (!available) {
        console.error(
          "[HealthService] HealthKit is not available on this device. " +
            "HealthKit is disabled on simulators and Mac Catalyst targets.",
        );
        return false;
      }

      // Step 2: Request read authorization for SDNN-based HRV.
      // requestAuthorization takes a single AuthDataTypes object: { toShare, toRead }
      // and returns Promise<boolean> — true if the request was presented to the user
      // (or permissions were already granted), false if HealthKit is unavailable.
      // NOTE: Apple does NOT reveal read denial status (privacy), so a `true` return
      // simply means the authorization sheet was shown; we proceed and let the query fail.
      try {
        const granted = await requestAuthorization({
          // In development, request write access so we can seed mock data into the simulator.
          toShare: __DEV__
            ? ([HRV_SDNN_TYPE] as SampleTypeIdentifierWriteable[])
            : [],
          toRead: [HRV_SDNN_TYPE],
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

        // Request explicit read permission for HRV on Android.
        await requestPermission([
          { accessType: "read", recordType: "HeartRateVariabilityRmssd" },
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
      await this.syncHRV_iOS(start, end, filterTimestamps);
    } else if (Platform.OS === "android") {
      await this.syncHRV_Android(start, end, filterTimestamps);
    }
  }

  /**
   * iOS HRV sync using @kingstinct/react-native-healthkit.
   */
  private async syncHRV_iOS(
    since: number,
    until: number,
    filterTimestamps?: number[],
  ): Promise<void> {
    try {
      const samples = await queryQuantitySamples(HRV_SDNN_TYPE, {
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
        // This ensures a maximum of ~3 health records per 10s CLI event window (start, mid, end).
        const isWithinContext = filterTimestamps
          ? filterTimestamps.some((pivot) => Math.abs(ts - pivot) <= 5000)
          : true;

        if (ts > since && isWithinContext) {
          await databaseService.recordBiometric({
            timestamp: ts,
            type: "HRV",
            value: sample.quantity,
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
        `[HealthService] iOS context sync — stored ${storedCount}/${samples.length} samples.`,
      );
    } catch (error) {
      console.error("[HealthService] Failed to fetch iOS HRV data:", error);
    }
  }

  /**
   * Android HRV sync using react-native-health-connect.
   */
  private async syncHRV_Android(
    since: number,
    until: number,
    filterTimestamps?: number[],
  ): Promise<void> {
    try {
      const startTime = new Date(since).toISOString();
      const endTime = new Date(until).toISOString();

      const result = await readRecords("HeartRateVariabilityRmssd", {
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
          await databaseService.recordBiometric({
            timestamp: ts,
            type: "HRV",
            value: record.heartRateVariabilityMillis,
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
        `[HealthService] Android context sync — stored ${storedCount}/${result.records.length} samples.`,
      );
    } catch (error) {
      console.error("[HealthService] Android sync error:", error);
    }
  }
  /**
   * Seeds the iOS HealthKit store with mock HRV samples manually.
   * Useful for testing the sync anchor patterns and data visualization.
   */
  public async seedMockData(
    count: number = 5,
    windowMinutes: number = 60,
  ): Promise<void> {
    try {
      console.log(
        `[HealthService] Injecting ${count} mock HRV samples over ${windowMinutes}m...`,
      );

      const interval = Math.floor(windowMinutes / count);

      for (let i = 0; i < count; i++) {
        const timestamp = new Date(Date.now() - i * interval * 60 * 1000);
        await saveQuantitySample(
          HRV_SDNN_TYPE as QuantityTypeIdentifierWriteable,
          "ms",
          Math.floor(Math.random() * (95 - 35) + 35), // Range: 35-95ms
          timestamp,
          timestamp,
        );
      }
      console.log("[HealthService] Mock data injection completed.");
    } catch (error) {
      console.error("[HealthService] Failed manual injection:", error);
      throw error;
    }
  }
}

export const healthService = new HealthService();
