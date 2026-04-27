import { databaseService, HeartRateSample } from "../db/DatabaseService";
import { TelemetryEvent } from "./AIService";

export type SessionInsight = {
  id: number;
  start_timestamp: number;
  end_timestamp: number;
  machine_name: string;
  churn_rate: number;
  churn_scaled: number;
  idle_timer: number;
  sessions_data: { app: string; title: string; duration_sec: number }[];
  avg_bpm: number;
  samples: HeartRateSample[];
  index: number;
};

export type ProcessedInsights = {
  sessions: SessionInsight[];
  avgHr: number;
  totalCount: number;
};

class InsightsService {
  /**
   * Fetches the high-density session data from the last `windowMs` milliseconds
   * and processes it for the UI/Charts.
   *
   * @param limit     Max records to load (default: 144 — one per 10 min over 24h).
   * @param windowMs  Time window to look back (default: 24 hours).
   */
  async getInsightsData(
    limit: number = 144,
    windowMs: number = 24 * 60 * 60 * 1000,
  ): Promise<ProcessedInsights> {
    const sinceTs = Date.now() - windowMs;
    const rawSessions = await databaseService.getTelemetryWithSamplesSince(
      sinceTs,
      limit,
    );

    const processed = this.processRawSessions(rawSessions);
    const totalCount = await databaseService.getTelemetryCountSince(sinceTs);

    return {
      sessions: processed,
      avgHr: this.calculateAvgHr(processed),
      totalCount,
    };
  }

  /**
   * Fetches insights with pagination support.
   */
  async getInsightsPaginated(
    offset: number,
    limit: number = 50,
  ): Promise<{ sessions: SessionInsight[]; hasMore: boolean }> {
    const rawSessions = await databaseService.getTelemetryWithSamplesPaginated(
      offset,
      limit,
    );

    const processed = this.processRawSessions(rawSessions);
    return {
      sessions: processed,
      hasMore: rawSessions.length === limit,
    };
  }

  private processRawSessions(
    rawSessions: (any & { samples: HeartRateSample[] })[],
  ): SessionInsight[] {
    return rawSessions.map((s) => {
      const avgBpm =
        s.samples.length > 0
          ? Math.round(
              s.samples.reduce(
                (acc: number, p: HeartRateSample) => acc + p.bpm,
                0,
              ) / s.samples.length,
            )
          : 0;

      // Normalize churn_rate to "switches per minute" based on actual window duration
      const windowMinutes = (s.end_timestamp - s.start_timestamp) / 60000 || 2;
      const churnPerMin = s.churn_rate / windowMinutes;

      return {
        id: s.id!,
        start_timestamp: s.start_timestamp,
        end_timestamp: s.end_timestamp,
        machine_name: s.machine_name,
        churn_rate: churnPerMin,
        idle_timer: s.idle_timer,
        sessions_data: s.sessions_data,
        avg_bpm: avgBpm,
        samples: s.samples,
        index: 0,
        // Scale churn for visualization (0-120)
        // We use a sensitivity factor of 20:
        // 0 switches/min = 2% (fixed baseline for visibility)
        // 6 switches/min = 122% (capped at 120%)
        churn_scaled: Math.min(120, Math.max(0, churnPerMin * 20 + 2)),
      };
    });
  }

  private calculateAvgHr(sessions: SessionInsight[]): number {
    const validSessions = sessions.filter((s) => s.avg_bpm > 0);
    return validSessions.length > 0
      ? Math.round(
          validSessions.reduce((acc, s) => acc + s.avg_bpm, 0) /
            validSessions.length,
        )
      : 0;
  }

  /**
   * Transforms raw data into the high-density telemetry payload required by the AI service.
   */
  buildAIPayload(
    sessions: SessionInsight[],
    count: number = 10,
  ): TelemetryEvent[] {
    // 1. Filter out sessions without any heart rate samples
    // 2. Take the 'count' most recent records (they are newest-first in the array)
    // 3. Reverse them so the LLM sees them in chronological order.
    return sessions
      .filter((s) => s.samples.length > 0)
      .slice(0, count)
      .reverse()
      .map((s) => ({
        churn_rate: s.churn_rate,
        idle_timer: s.idle_timer,
        sessions_data: s.sessions_data,
        // Downsample HR to ~1 sample every 15s to save tokens while keeping tempo.
        // A 120s window now has ~8 samples instead of potentially 120+.
        hr_samples: s.samples.filter((_, idx) => idx % 15 === 0),
      }));
  }

  calculateFocusScore(epochs: SessionInsight[]): number {
    if (!epochs.length) return 0;

    const WEIGHT_STABILITY = 0.35;
    const WEIGHT_ENGAGEMENT = 0.65;
    const CHURN_DECAY_LAMBDA = 0.5;

    const epochScores = epochs.map((epoch) => {
      // 1. Precise Window Duration (seconds)
      const windowSec = Math.max(
        (epoch.end_timestamp - epoch.start_timestamp) / 1000,
        1,
      );

      // 2. Stability: Use churn_rate with exponential decay.
      // If churn_scaled is already 0-1 (1 being good), you could use that directly.
      const stability = Math.exp(-CHURN_DECAY_LAMBDA * epoch.churn_rate);

      // 3. Engagement: Maximize duration of primary app vs total window time.
      // We subtract idle_timer to ensure focus is "active" focus.
      const maxActiveSec = Math.max(
        ...epoch.sessions_data.map((s) => s.duration_sec),
        0,
      );
      const activeWindow = Math.max(windowSec - epoch.idle_timer, 1);
      const engagement = Math.min(maxActiveSec / activeWindow, 1);

      // 4. Biometric Coherence (Variability Check)
      let coherence = 1.0;
      if (epoch.samples.length > 2) {
        const bpms = epoch.samples.map((s) => s.bpm);
        const mean = bpms.reduce((a, b) => a + b, 0) / bpms.length;
        const stdDev = Math.sqrt(
          bpms.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) /
            bpms.length,
        );
        // CV = stdDev / mean. Lower variability = higher coherence.
        coherence = Math.max(0, 1 - stdDev / mean);
      }

      // 5. Idle Penalty: If the user was idle for > 50% of the window,
      // we scale the whole score down proportionally.
      const idleMultiplier = Math.max(0, 1 - epoch.idle_timer / windowSec);

      return (
        (WEIGHT_STABILITY * stability + WEIGHT_ENGAGEMENT * engagement) *
        coherence *
        idleMultiplier *
        100
      );
    });

    // 6. Recency-Weighted Aggregation
    let totalWeightedScore = 0;
    let totalWeight = 0;

    epochScores.forEach((score, index) => {
      const weight = index + 1; // More recent epochs weigh more
      totalWeightedScore += score * weight;
      totalWeight += weight;
    });

    return Math.round(totalWeightedScore / totalWeight);
  }
}

export const insightsService = new InsightsService();
