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
import { REPORTING_WINDOW_MS } from "../../constants/Config";
import { databaseService, HeartRateSample } from "../../db/DatabaseService";
import { BaseHealthService } from "./BaseHealthService";

const HR_TYPE: QuantityTypeIdentifier = "HKQuantityTypeIdentifierHeartRate";

class HealthServiceIOS extends BaseHealthService {
  async authorize(): Promise<boolean> {
    const available = isHealthDataAvailable();
    if (!available) {
      console.error(
        "[HealthService] HealthKit is not available on this device.",
      );
      return false;
    }

    try {
      const granted = await requestAuthorization({
        toShare: __DEV__ ? ([HR_TYPE] as SampleTypeIdentifierWriteable[]) : [],
        toRead: [HR_TYPE],
      });

      if (!granted) {
        console.warn(
          "[HealthService] iOS HealthKit authorization request failed.",
        );
        return false;
      }

      this.isAuthorized = true;
      return true;
    } catch (error) {
      console.error("[HealthService] iOS Authorization Error:", error);
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

    const samples = await queryQuantitySamples(HR_TYPE, {
      unit: "count/min",
      filter: {
        date: {
          startDate: new Date(start),
          endDate: new Date(end),
        },
      },
      ascending: true,
      limit: 0,
    });

    if (!samples || samples.length === 0) {
      return [];
    }

    return samples.map((sample) => ({
      ts: new Date(sample.startDate).getTime(),
      bpm: Math.round(sample.quantity),
    }));
  }

  public async seedMockData(
    count: number = 2,
    windowMinutes: number = 60,
  ): Promise<{ count: number; contextTimestamps: number[] }> {
    const startTime = Date.now() - windowMinutes * 60 * 1000;
    const telemetryItems = await databaseService.getTelemetryPaginated(0, 100);

    if (telemetryItems.length === 0) return { count: 0, contextTimestamps: [] };

    const contextTimestamps = telemetryItems.map((item) => item.timestamp);
    const samplesPerPoint = Math.max(2, count);
    let totalInjected = 0;

    for (const item of telemetryItems) {
      for (let j = 0; j < samplesPerPoint; j++) {
        const offset = Math.floor(Math.random() * REPORTING_WINDOW_MS); // within the 60s window
        const ts = new Date(item.timestamp + offset);
        const bpm = Math.floor(Math.random() * (120 - 60) + 60);

        await saveQuantitySample(
          HR_TYPE as QuantityTypeIdentifierWriteable,
          "count/min",
          bpm,
          ts,
          ts,
        );
        totalInjected++;
      }
    }

    return { count: totalInjected, contextTimestamps };
  }
}

export const healthService = new HealthServiceIOS();

/** iOS does not have the Health Connect permission dialog lifecycle issue — always false. */
export const isPermissionFlowActive = false;
