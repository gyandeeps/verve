import { databaseService } from "@/db/DatabaseService";
import { TelemetryEvent } from "@/services/AIService";

export type CombinedDataPoint = {
  active_app: string;
  window_title: string;
  work_ts: number;
  churn_rate: number;
  churn_scaled: number;
  idle_timer: number;
  type: string;
  value: number;
  bio_ts: number;
};

export type ProcessedInsights = {
  smoothed: CombinedDataPoint[];
  raw: CombinedDataPoint[];
  avgHr: number;
  focusScore: number;
};

class InsightsService {
  /**
   * Fetches the raw combined data points from the database and processes them.
   * Applies window-smoothing and calculates the focus score and average heart rate.
   */
  async getInsightsData(limit: number = 200): Promise<ProcessedInsights> {
    const results = await databaseService.getCombinedData(limit);
    const validPoints = (results as CombinedDataPoint[]).filter(
      (p) => p.value != null && p.work_ts != null,
    );
    const sorted = [...validPoints].sort((a, b) => a.work_ts - b.work_ts);

    const smoothed: CombinedDataPoint[] = [];
    const windowSize = 5;
    for (let i = 0; i < sorted.length; i += windowSize) {
      const chunk = sorted.slice(i, i + windowSize);
      if (chunk.length === 0) continue;

      const sumValue = chunk.reduce(
        (acc, p) => acc + (Number(p.value) || 0),
        0,
      );
      const avgValue = sumValue / chunk.length;

      const sumChurn = chunk.reduce(
        (acc, p) => acc + (Number(p.churn_rate) || 0),
        0,
      );
      const avgChurn = sumChurn / chunk.length;

      const midPoint = chunk[Math.floor(chunk.length / 2)];

      smoothed.push({
        ...midPoint,
        value: Number.isFinite(avgValue) ? avgValue : 0,
        churn_scaled: Math.min(
          100,
          Math.max(0, (Number.isFinite(avgChurn) ? avgChurn : 0) * 80),
        ),
      });
    }

    let avgHr = 0;
    let focusScore = 0;

    if (validPoints.length > 0) {
      const sum = validPoints.reduce(
        (acc, p) => acc + (Number(p.value) || 0),
        0,
      );
      const avg = sum / validPoints.length;

      avgHr = Math.round(Number.isFinite(avg) ? avg : 0);
      // Ensure focusScore is a valid number
      const calculatedFocus = 100 - (avgHr - 55) * 2;
      focusScore = Math.max(
        0,
        Math.min(100, Number.isFinite(calculatedFocus) ? calculatedFocus : 0),
      );
    }

    return {
      smoothed,
      raw: sorted,
      avgHr,
      focusScore: Math.round(focusScore),
    };
  }

  /**
   * Transforms raw data into the telemetry payload format required by the AI service.
   */
  buildAIPayload(
    rawData: CombinedDataPoint[],
    count: number = 10,
  ): TelemetryEvent[] {
    return rawData.slice(-count).map((p) => ({
      timestamp: new Date(p.work_ts).toISOString(),
      app_name: p.active_app,
      window_title: p.window_title?.slice(0, 40),
      churn_rate: p.churn_rate,
      idle_time_sec: p.idle_timer ?? 0,
      hr_points: p.value != null ? [p.value] : [],
    }));
  }
}

export const insightsService = new InsightsService();
