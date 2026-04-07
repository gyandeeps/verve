import { databaseService, HeartRateSample } from "../db/DatabaseService";
import { TelemetryEvent } from "./AIService";

export type SessionInsight = {
  id: number;
  timestamp: number;
  machine_name: string;
  churn_rate: number;
  churn_scaled: number;
  idle_timer: number;
  sessions_data: { app: string; title: string; duration_sec: number }[];
  avg_bpm: number;
  samples: HeartRateSample[];
};

export type ProcessedInsights = {
  sessions: SessionInsight[];
  avgHr: number;
  focusScore: number;
  totalCount: number;
};

class InsightsService {
  /**
   * Fetches the high-density session data and processes it for the UI/Charts.
   */
  async getInsightsData(
    offset: number = 0,
    limit: number = 50,
  ): Promise<ProcessedInsights> {
    const rawSessions = await databaseService.getTelemetryWithSamplesPaginated(
      offset,
      limit,
    );

    // Process each session block
    const processed: SessionInsight[] = rawSessions.map((s) => {
      const avgBpm =
        s.samples.length > 0
          ? Math.round(
              s.samples.reduce((acc, p) => acc + p.bpm, 0) / s.samples.length,
            )
          : 0;

      return {
        id: s.id!,
        timestamp: s.timestamp,
        machine_name: s.machine_name,
        churn_rate: s.churn_rate,
        idle_timer: s.idle_timer,
        sessions_data: s.sessions_data,
        avg_bpm: avgBpm,
        samples: s.samples,
        // Scale churn for visualization (0-100)
        // A churn rate of 1.25 (switches/min) will now hit 100 on the graph,
        // making subtle context switching patterns more visible.
        churn_scaled: Math.min(100, Math.max(0, s.churn_rate * 80)),
      };
    });

    // Calculate global stats
    const validSessions = processed.filter((s) => s.avg_bpm > 0);
    const avgHr =
      validSessions.length > 0
        ? Math.round(
            validSessions.reduce((acc, s) => acc + s.avg_bpm, 0) /
              validSessions.length,
          )
        : 0;

    // Focus Score Logic (Simplified correlation)
    let focusScore = 0;
    if (avgHr > 0) {
      const calculatedFocus = 100 - (avgHr - 55) * 2;
      focusScore = Math.min(100, Math.max(0, calculatedFocus));
    }

    const totalCount = await databaseService.getTelemetryCount();

    return {
      sessions: processed.sort((a, b) => b.timestamp - a.timestamp), // Newest first for pagination
      avgHr,
      focusScore: Math.round(focusScore),
      totalCount,
    };
  }

  /**
   * Transforms raw data into the high-density telemetry payload required by the AI service.
   */
  buildAIPayload(
    sessions: SessionInsight[],
    count: number = 10,
  ): TelemetryEvent[] {
    // Take the 'count' most recent records (they are newest-first in the array)
    // and reverse them so the LLM sees them in chronological order.
    return sessions
      .slice(0, count)
      .reverse()
      .map((s) => ({
        timestamp: new Date(s.timestamp).toISOString(),
        machine_name: s.machine_name,
        churn_rate: s.churn_rate,
        idle_timer: s.idle_timer,
        sessions_data: s.sessions_data,
        hr_samples: s.samples,
      }));
  }
}

export const insightsService = new InsightsService();
