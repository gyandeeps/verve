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
        // We use a sensitivity factor of 30 to align with the Focus Score penalty:
        // 0 switches/min = 5 (fixed baseline for visibility)
        // 4 switches/min = 125 (capped at 120)
        churn_scaled: Math.min(120, Math.max(0, churnPerMin * 30 + 5)),
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
      .map((s) => {
        // Aggregate apps to a concise string
        const appSummary = s.sessions_data.reduce(
          (acc, curr) => {
            acc[curr.app] = (acc[curr.app] || 0) + (curr.duration_sec || 0);
            return acc;
          },
          {} as Record<string, number>,
        );

        // Calculate HR stats instead of an array
        const bpms = s.samples.map((sample) => sample.bpm);
        const avgHr = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
        const maxHr = Math.round(Math.max(...bpms));

        return {
          cr: Math.round(s.churn_rate * 10) / 10,
          it: s.idle_timer,
          apps: Object.entries(appSummary)
            .map(([app, sec]) => `${app}:${sec}s`)
            .join(", "),
          hr: `${avgHr} (max:${maxHr})`,
        };
      });
  }

  calculateFocusScore(epochs: SessionInsight[]): number {
    if (!epochs.length) return 0;

    const WEIGHT_STABILITY = 0.35;
    const WEIGHT_ENGAGEMENT = 0.65;
    const CHURN_DECAY_LAMBDA = 0.25;

    const epochScores = epochs.map((epoch) => {
      // 1. Precise Window Duration (seconds)
      const windowSec = Math.max(
        (epoch.end_timestamp - epoch.start_timestamp) / 1000,
        1,
      );

      // 2. Stability: Use churn_rate with exponential decay.
      const churnRate = epoch.churn_rate || 0;
      const stability = Math.exp(-CHURN_DECAY_LAMBDA * churnRate);

      // 3. Engagement: Maximize total duration of the primary app vs active window time.
      const sessionsData = epoch.sessions_data || [];
      const idleTimer = epoch.idle_timer || 0;

      // Aggregate durations by app to avoid double-penalizing context switching
      const appDurations: Record<string, number> = {};
      sessionsData.forEach((s) => {
        appDurations[s.app] =
          (appDurations[s.app] || 0) + (s.duration_sec || 0);
      });
      const maxActiveSec = Math.max(0, ...Object.values(appDurations));
      const activeWindow = Math.max(windowSec - idleTimer, 1);
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
        // Safety check: if mean is 0, CV is undefined.
        coherence = mean > 0 ? Math.max(0, 1 - stdDev / mean) : 1.0;
      }

      // 5. Idle Penalty: If the user was idle for > 50% of the window,
      // we scale the whole score down proportionally.
      const idleMultiplier = Math.max(0, 1 - idleTimer / windowSec);

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
      // Since epochs are newest-first, we reverse the weight:
      // index 0 (newest) gets weight 'length', index n-1 (oldest) gets weight 1.
      const weight = epochs.length - index;
      totalWeightedScore += score * weight;
      totalWeight += weight;
    });

    const result = Math.round(totalWeightedScore / totalWeight);
    return isNaN(result) ? 0 : result;
  }
}

export const insightsService = new InsightsService();
