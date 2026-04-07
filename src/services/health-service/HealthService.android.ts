import { AppState } from "react-native";
import {
  getGrantedPermissions,
  initialize,
  insertRecords,
  readRecords,
  requestPermission,
} from "react-native-health-connect";
import { REPORTING_WINDOW_MS } from "../../constants/Config";
import { databaseService, HeartRateSample } from "../../db/DatabaseService";
import { BaseHealthService } from "./BaseHealthService";

/**
 * Exported flag that signals the Health Connect permission dialog is actively
 * being shown. Other modules (e.g. Monitor) MUST check this before severing
 * connections on app-background events — the permission dialog is a separate
 * Activity, which causes our app to appear "backgrounded".
 */
export let isPermissionFlowActive = false;

class HealthServiceAndroid extends BaseHealthService {
  private authInProgress: Promise<boolean> | null = null;
  private sdkInitialized = false;

  /**
   * Request platform-specific authorization for health data (HR).
   *
   * The native `requestPermission()` API depends on an `ActivityResultLauncher`
   * registered in `MainActivity.onCreate()` via
   * `HealthConnectPermissionDelegate.setPermissionDelegate(this)`.
   *
   * This is handled by our custom Expo config plugin at:
   *   plugins/withHealthConnectPermissionDelegate.js
   *
   * WARNING: Without that plugin, the lateinit `requestPermission` property
   * will never be initialized, causing a fatal crash on Android.
   */
  async authorize(): Promise<boolean> {
    if (this.isAuthorized) return true;
    if (this.authInProgress) {
      console.log(
        "[HealthService] Authorization already in progress, awaiting...",
      );
      return this.authInProgress;
    }

    this.authInProgress = this.performAuth();
    try {
      const result = await this.authInProgress;
      this.isAuthorized = result;
      return result;
    } finally {
      this.authInProgress = null;
    }
  }

  private async performAuth(): Promise<boolean> {
    try {
      if (!this.sdkInitialized) {
        console.log("[HealthService] Initializing Health Connect SDK...");
        const isInitialized = await initialize();

        if (!isInitialized) {
          console.error(
            "[HealthService] Health Connect SDK could not be initialized. " +
              "Verify Health Connect app is installed and configured.",
          );
          return false;
        }
        this.sdkInitialized = true;
      }

      // ── Fast-path: check if permission is already granted ───────────
      // getGrantedPermissions() reads directly from HealthConnectClient
      // and doesn't use ActivityResultLauncher, so it's always safe.
      const hasPermission = await this.checkHeartRatePermission();
      if (hasPermission) {
        console.log("[HealthService] HeartRate permission already verified.");
        return true;
      }

      // ── Foreground Guard ────────────────────────────────────────────
      // The permission dialog is a separate Activity. We must be in the
      // foreground before launching it.
      if (AppState.currentState !== "active") {
        console.warn(
          "[HealthService] Postponing permission request: App is not in foreground.",
        );
        return false;
      }

      // ── Request Permission ──────────────────────────────────────────
      // Set the flow flag so Monitor's AppState listener doesn't sever
      // the TCP connection when the permission dialog pushes our Activity
      // to background.
      console.log("[HealthService] Requesting HeartRate permissions via UI...");
      isPermissionFlowActive = true;

      try {
        const permissions: any[] = [
          { accessType: "read", recordType: "HeartRate" },
        ];

        // Only request write permissions in development for mock seeding
        if (__DEV__) {
          permissions.push({ accessType: "write", recordType: "HeartRate" });
        }

        const grantedPermissions = await requestPermission(permissions);

        const newlyGranted = grantedPermissions.some(
          (p) => p.recordType === "HeartRate",
        );

        if (newlyGranted) {
          console.log("[HealthService] HeartRate permission granted by user.");
          return true;
        } else {
          console.warn("[HealthService] HeartRate permission denied by user.");
          return false;
        }
      } finally {
        isPermissionFlowActive = false;
      }
    } catch (e: any) {
      isPermissionFlowActive = false;
      const errMsg = e?.message || String(e);
      console.error(
        "[HealthService] Android initialization/permission error:",
        errMsg,
      );
      return false;
    }
  }

  /**
   * Check if HeartRate read permission is currently granted.
   */
  private async checkHeartRatePermission(): Promise<boolean> {
    try {
      const existing = await getGrantedPermissions();
      const hasRead = existing.some(
        (p: any) => p.recordType === "HeartRate" && p.accessType === "read",
      );

      // In development, also check for write permission to avoid triggering
      // write-access SecurityExceptions during data seeding.
      if (__DEV__) {
        const hasWrite = existing.some(
          (p: any) => p.recordType === "HeartRate" && p.accessType === "write",
        );
        return hasRead && hasWrite;
      }

      return hasRead;
    } catch (err: any) {
      console.warn(
        "[HealthService] getGrantedPermissions failed:",
        err?.message,
      );
      return false;
    }
  }

  /**
   * Precise query for Heart Rate samples within a window.
   */
  async queryHeartRateSamples(
    start: number,
    end: number,
  ): Promise<HeartRateSample[]> {
    if (!this.isAuthorized) {
      const authorized = await this.authorize();
      if (!authorized) return [];
    }

    const startTime = new Date(start).toISOString();
    const endTime = new Date(end).toISOString();

    const result = await readRecords("HeartRate", {
      timeRangeFilter: {
        operator: "between",
        startTime,
        endTime,
      },
    });

    if (!result.records || result.records.length === 0) {
      return [];
    }

    const samples: HeartRateSample[] = [];

    for (const record of result.records) {
      const tsStr =
        (record as any).startTime ||
        (record as any).time ||
        record.metadata?.lastModifiedTime;
      const ts = tsStr ? new Date(tsStr).getTime() : Date.now();

      const recordSamples = (record as any).samples ?? [];
      if (recordSamples.length > 0) {
        for (const s of recordSamples) {
          samples.push({
            ts: s.time ? new Date(s.time).getTime() : ts,
            bpm: Math.round(s.beatsPerMinute),
          });
        }
      } else {
        samples.push({
          ts: ts,
          bpm: (record as any).beatsPerMinute ?? 0,
        });
      }
    }

    return samples;
  }

  public async seedMockData(
    count: number = 2,
    windowMinutes: number = 60,
  ): Promise<{ count: number; contextTimestamps: number[] }> {
    if (!__DEV__) {
      return { count: 0, contextTimestamps: [] };
    }

    const authorized = await this.authorize();
    if (!authorized) {
      return { count: 0, contextTimestamps: [] };
    }

    const startTime = Date.now() - windowMinutes * 60 * 1000;
    const telemetryItems = await databaseService.getTelemetryPaginated(0, 100);

    if (telemetryItems.length === 0) return { count: 0, contextTimestamps: [] };

    const contextTimestamps = telemetryItems.map(
      (item) => item.start_timestamp,
    );
    const samplesPerPoint = Math.max(2, count);
    const records: any[] = [];

    for (const item of telemetryItems) {
      for (let j = 0; j < samplesPerPoint; j++) {
        const offset = Math.floor(Math.random() * REPORTING_WINDOW_MS); // within 120s
        const ts = item.start_timestamp + offset;
        const bpm = Math.floor(Math.random() * (120 - 60) + 60);

        const isoTime = new Date(ts).toISOString();
        const isoEndTime = new Date(ts + 1000).toISOString();

        records.push({
          recordType: "HeartRate",
          startTime: isoTime,
          endTime: isoEndTime,
          samples: [
            {
              time: isoTime,
              beatsPerMinute: bpm,
            },
          ],
        });
      }
    }

    try {
      console.log(
        `[HealthService] Seeding ${records.length} HeartRate records...`,
      );
      const result = await insertRecords(records);
      return { count: result.length, contextTimestamps };
    } catch (err: any) {
      console.error("[HealthService] Failed to seed mock data:", err?.message);
      console.error(err);
      return { count: 0, contextTimestamps: [] };
    }
  }
}

export const healthService = new HealthServiceAndroid();
