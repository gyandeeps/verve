import { databaseService } from "../db/DatabaseService";

export type Timeframe = "today" | "last7days" | "last30days" | "alltime";

export type TopAppTime = {
  app_name: string;
  total_duration_sec: number;
};

export type AppStressTrigger = {
  primary_app: string;
  peak_bpm: number;
  overall_avg_bpm: number;
};

export type StatsOverview = {
  average_churn_rate: number;
  deep_flow_time_sec: number; // Time in flow (churn <= 1 and idle > 0 is a decent proxy, or just low churn)
};

class StatsService {
  private getTimeRange(timeframe: Timeframe): { start: number; end: number } {
    const end = Date.now();
    let start = 0;

    switch (timeframe) {
      case "today":
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        start = today.getTime();
        break;
      case "last7days":
        start = end - 7 * 24 * 60 * 60 * 1000;
        break;
      case "last30days":
        start = end - 30 * 24 * 60 * 60 * 1000;
        break;
      case "alltime":
        start = 0;
        break;
    }
    return { start, end };
  }

  async getTopAppsByTime(
    timeframe: Timeframe,
    limit: number = 5,
  ): Promise<TopAppTime[]> {
    const db = await databaseService.init();
    const { start, end } = this.getTimeRange(timeframe);

    const query = `
      SELECT 
        COALESCE(json_extract(value, '$.app'), 'Unknown') as app_name, 
        CAST(SUM(COALESCE(json_extract(value, '$.duration_sec'), 0)) AS INTEGER) as total_duration_sec 
      FROM telemetry, json_each(telemetry.sessions_data) 
      WHERE start_timestamp BETWEEN ? AND ? 
      GROUP BY app_name 
      ORDER BY total_duration_sec DESC 
      LIMIT ?
    `;

    return await db.getAllAsync<TopAppTime>(query, [start, end, limit]);
  }

  async getTopStressTriggers(
    timeframe: Timeframe,
    limit: number = 5,
  ): Promise<AppStressTrigger[]> {
    const db = await databaseService.init();
    const { start, end } = this.getTimeRange(timeframe);

    // Identify the dominant app in each block, calculate max HR for the block, and aggregate
    const query = `
      WITH PrimaryApps AS (
        SELECT id,
               (SELECT json_extract(value, '$.app')
                FROM json_each(sessions_data)
                ORDER BY CAST(json_extract(value, '$.duration_sec') AS INTEGER) DESC
                LIMIT 1) as primary_app
        FROM telemetry
        WHERE start_timestamp BETWEEN ? AND ?
      ),
      BlockHR AS (
        SELECT telemetry_id, MAX(bpm) as max_bpm, AVG(bpm) as avg_bpm
        FROM hr_samples
        GROUP BY telemetry_id
      )
      SELECT 
        COALESCE(pa.primary_app, 'Unknown') as primary_app, 
        CAST(AVG(COALESCE(b.avg_bpm, 0)) AS REAL) as overall_avg_bpm, 
        CAST(MAX(COALESCE(b.max_bpm, 0)) AS REAL) as peak_bpm
      FROM PrimaryApps pa
      JOIN BlockHR b ON pa.id = b.telemetry_id
      GROUP BY pa.primary_app
      ORDER BY peak_bpm DESC
      LIMIT ?
    `;

    return await db.getAllAsync<AppStressTrigger>(query, [start, end, limit]);
  }

  async getStatsOverview(timeframe: Timeframe): Promise<StatsOverview> {
    const db = await databaseService.init();
    const { start, end } = this.getTimeRange(timeframe);

    // Deep flow is considered blocks with low churn (< 2.0) and moderate to zero idle.
    // Each block is roughly 120 seconds. We'll sum 120 for each deep flow block.
    const query = `
      SELECT 
        CAST(AVG(COALESCE(churn_rate, 0)) AS REAL) as average_churn_rate,
        CAST(SUM(CASE WHEN churn_rate < 2.0 THEN 120 ELSE 0 END) AS INTEGER) as deep_flow_time_sec
      FROM telemetry
      WHERE start_timestamp BETWEEN ? AND ?
    `;

    const result = await db.getFirstAsync<{
      average_churn_rate: number | null;
      deep_flow_time_sec: number | null;
    }>(query, [start, end]);

    return {
      average_churn_rate: result?.average_churn_rate || 0,
      deep_flow_time_sec: result?.deep_flow_time_sec || 0,
    };
  }

  async getRecoveryEfficiency(
    timeframe: Timeframe,
  ): Promise<{ score: number; count: number }> {
    const db = await databaseService.init();
    const { start, end } = this.getTimeRange(timeframe);

    const query = `
      SELECT id, start_timestamp, end_timestamp, idle_timer
      FROM telemetry
      WHERE start_timestamp BETWEEN ? AND ? AND idle_timer >= 60000
    `;
    const blocks = await db.getAllAsync<{
      id: number;
      start_timestamp: number;
      end_timestamp: number;
      idle_timer: number;
    }>(query, [start, end]);

    let totalRes = 0;
    let count = 0;

    for (const block of blocks) {
      const samples = await db.getAllAsync<{ ts: number; bpm: number }>(
        `SELECT ts, bpm FROM hr_samples WHERE telemetry_id = ? ORDER BY ts ASC`,
        [block.id],
      );
      if (samples.length >= 2) {
        const first = samples[0];
        const targetTs = first.ts + 60000;
        let closest = samples[1];
        let minDelta = Math.abs(closest.ts - targetTs);

        for (let i = 2; i < samples.length; i++) {
          const delta = Math.abs(samples[i].ts - targetTs);
          if (delta < minDelta) {
            minDelta = delta;
            closest = samples[i];
          }
        }

        if (Math.abs(closest.ts - targetTs) <= 30000) {
          const drop = first.bpm - closest.bpm;
          totalRes += Math.max(0, drop);
          count++;
        }
      }
    }

    return {
      score: count > 0 ? Math.round(totalRes / count) : 0,
      count,
    };
  }

  async getCognitiveStatesBreakdown(timeframe: Timeframe): Promise<{
    deepFlowCount: number;
    thinkingStressCount: number;
    reactivePanicCount: number;
    total: number;
  }> {
    const db = await databaseService.init();
    const { start, end } = this.getTimeRange(timeframe);

    const query = `
      WITH BlockHR AS (
        SELECT telemetry_id, AVG(bpm) as avg_bpm
        FROM hr_samples
        GROUP BY telemetry_id
      )
      SELECT 
        t.churn_rate,
        COALESCE(b.avg_bpm, 0) as avg_bpm
      FROM telemetry t
      LEFT JOIN BlockHR b ON t.id = b.telemetry_id
      WHERE t.start_timestamp BETWEEN ? AND ?
    `;

    const rows = await db.getAllAsync<{ churn_rate: number; avg_bpm: number }>(
      query,
      [start, end],
    );

    let deepFlowCount = 0;
    let thinkingStressCount = 0;
    let reactivePanicCount = 0;

    for (const row of rows) {
      const bpm = row.avg_bpm;
      const churn = row.churn_rate;

      if (bpm > 0 && bpm < 70 && churn < 1.5) {
        deepFlowCount++;
      } else if (bpm >= 80 && churn < 1.5) {
        thinkingStressCount++;
      } else if (bpm >= 80 && churn > 3.0) {
        reactivePanicCount++;
      }
    }

    return {
      deepFlowCount,
      thinkingStressCount,
      reactivePanicCount,
      total: rows.length,
    };
  }
}

export const statsService = new StatsService();
