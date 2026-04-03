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
import { databaseService } from "../../db/DatabaseService";
import { BaseHealthService, SYNC_ANCHOR_KEY } from "./BaseHealthService";

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

  protected async fetchAndStoreHR(
    since: number,
    until: number,
    filterTimestamps?: number[],
  ): Promise<{
    storedCount: number;
    samplesCount: number;
    latestTimestamp: number;
  }> {
    const samples = await queryQuantitySamples(HR_TYPE, {
      unit: "count/min",
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
      return { storedCount: 0, samplesCount: 0, latestTimestamp: since };
    }

    let latestTimestamp = since;
    let storedCount = 0;

    for (const sample of samples) {
      const ts = new Date(sample.startDate).getTime();

      const isWithinContext = filterTimestamps
        ? filterTimestamps.some((pivot) => Math.abs(ts - pivot) <= 5000)
        : true;

      if (ts > since && isWithinContext) {
        const bpm = Math.round(sample.quantity);
        await this.recordHeartRate(ts, bpm);
        storedCount++;
      }
      if (ts > latestTimestamp) latestTimestamp = ts;
    }

    return { storedCount, samplesCount: samples.length, latestTimestamp };
  }

  public async seedMockData(
    count: number = 2,
    windowMinutes: number = 60,
  ): Promise<number> {
    const startTime = Date.now() - windowMinutes * 60 * 1000;
    const telemetryItems = await databaseService.getTelemetryInRange(
      startTime,
      Date.now(),
    );

    if (telemetryItems.length === 0) return 0;

    const samplesPerPoint = Math.max(2, count);
    let totalInjected = 0;

    for (const item of telemetryItems) {
      for (let j = 0; j < samplesPerPoint; j++) {
        const offset = Math.floor(Math.random() * 10001) - 5000;
        const ts = new Date(item.timestamp + offset);
        const bpm = Math.floor(Math.random() * (140 - 40) + 40);

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

    return totalInjected;
  }
}

export const healthService = new HealthServiceIOS();
