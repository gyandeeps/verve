import { AppState } from "react-native";
import {
  getGrantedPermissions,
  initialize,
  readRecords,
  requestPermission,
} from "react-native-health-connect";
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
      // ── SDK Initialization ──────────────────────────────────────────
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
        const grantedPermissions = await requestPermission([
          { accessType: "read", recordType: "HeartRate" },
        ]);

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
      return existing.some(
        (p) => p.recordType === "HeartRate" && p.accessType === "read",
      );
    } catch (err: any) {
      console.warn(
        "[HealthService] getGrantedPermissions failed:",
        err?.message,
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
