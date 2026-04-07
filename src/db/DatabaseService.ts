import * as SQLite from "expo-sqlite";
import { runMigrations } from "./migrations";

export type SessionBlock = {
  app: string;
  title: string;
  duration_sec: number;
};

export type TelemetryData = {
  id?: number;
  start_timestamp: number;
  end_timestamp: number;
  machine_name: string;
  churn_rate: number;
  idle_timer: number;
  sessions_data: SessionBlock[];
  ai_state?: string;
  ai_summary?: string;
};

export type HeartRateSample = {
  ts: number;
  bpm: number;
};

const DEBUG_FORCE_RESET = false;

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  async init(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync("verve_hub.db");

        if (DEBUG_FORCE_RESET) {
          console.warn("[DEV] Forcing migration reset (user_version = 0)...");
          await db.execAsync("PRAGMA user_version = 0");
        }

        // Use versioned migrations via runMigrations
        await runMigrations(db);

        // 30-Day Rolling Cleanup (All Nodes)
        // Prune records older than 30 days. Cascade deletes ensure hr_samples are pruned.
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        await db.runAsync(`DELETE FROM telemetry WHERE start_timestamp < ?`, [
          thirtyDaysAgo,
        ]);

        console.log("Mobile Database Initialized & Cleaned.");
        this.db = db;
        return db;
      } catch (err) {
        this.initPromise = null;
        console.error("Failed to initialize database:", err);
        throw err;
      }
    })();

    return this.initPromise;
  }

  async recordTelemetry(data: TelemetryData): Promise<number> {
    const db = await this.init();

    const result = await db.runAsync(
      `INSERT INTO telemetry (start_timestamp, end_timestamp, machine_name, churn_rate, idle_timer, sessions_data) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.start_timestamp,
        data.end_timestamp,
        data.machine_name,
        data.churn_rate,
        data.idle_timer,
        JSON.stringify(data.sessions_data),
      ],
    );
    return result.lastInsertRowId;
  }

  async recordHeartRateSamples(
    telemetryId: number,
    samples: HeartRateSample[],
  ) {
    const db = await this.init();

    // Batch insert for performance
    for (const sample of samples) {
      await db.runAsync(
        `INSERT INTO hr_samples (telemetry_id, ts, bpm) VALUES (?, ?, ?)`,
        [telemetryId, sample.ts, sample.bpm],
      );
    }
  }

  async getTelemetryPaginated(
    offset: number,
    limit: number = 10,
  ): Promise<TelemetryData[]> {
    const db = await this.init();

    const rows = await db.getAllAsync<any>(
      `SELECT * FROM telemetry ORDER BY start_timestamp DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    return rows.map((row) => ({
      ...row,
      sessions_data: JSON.parse(row.sessions_data),
    }));
  }

  async getTelemetryWithSamplesPaginated(
    offset: number,
    limit: number = 10,
  ): Promise<(TelemetryData & { samples: HeartRateSample[] })[]> {
    const db = await this.init();

    const telemetryRows = await db.getAllAsync<any>(
      `SELECT * FROM telemetry ORDER BY start_timestamp DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    const results: (TelemetryData & { samples: HeartRateSample[] })[] = [];

    for (const row of telemetryRows) {
      const samples = await db.getAllAsync<HeartRateSample>(
        `SELECT ts, bpm FROM hr_samples WHERE telemetry_id = ? ORDER BY ts ASC`,
        [row.id],
      );

      results.push({
        ...row,
        sessions_data: JSON.parse(row.sessions_data),
        samples,
      });
    }

    return results;
  }

  async getTelemetryWithSamples(
    telemetryId: number,
  ): Promise<TelemetryData & { samples: HeartRateSample[] }> {
    const db = await this.init();

    const telemetry = await db.getFirstAsync<any>(
      `SELECT * FROM telemetry WHERE id = ?`,
      [telemetryId],
    );

    if (!telemetry) throw new Error("Telemetry record not found");

    const samples = await db.getAllAsync<HeartRateSample>(
      `SELECT ts, bpm FROM hr_samples WHERE telemetry_id = ? ORDER BY ts ASC`,
      [telemetryId],
    );

    return {
      ...telemetry,
      sessions_data: JSON.parse(telemetry.sessions_data),
      samples,
    };
  }

  async getTelemetryCount(): Promise<number> {
    const db = await this.init();
    const result = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM telemetry",
    );
    return result?.count ?? 0;
  }

  async setMetadata(key: string, value: string) {
    const db = await this.init();

    await db.runAsync(
      `INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)`,
      [key, value],
    );
  }

  async getMetadata(key: string): Promise<string | null> {
    const db = await this.init();

    const result = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM metadata WHERE key = ?`,
      [key],
    );
    return result ? result.value : null;
  }

  async setAppCategory(appName: string, category: string) {
    const db = await this.init();
    const cleanApp = String(appName || "");
    const cleanCat = String(category || "Unknown");

    await db.runAsync(
      `INSERT OR REPLACE INTO app_categories (app_name, category) VALUES (?, ?)`,
      [cleanApp, cleanCat],
    );
  }

  async clearAllTables() {
    const db = await this.init();

    await db.execAsync(`
      DELETE FROM telemetry;
      DELETE FROM hr_samples;
      DELETE FROM metadata;
      DELETE FROM app_categories;
      DELETE FROM sqlite_sequence WHERE name IN ('telemetry', 'hr_samples');
    `);

    console.warn("[DatabaseService] Local database has been purged.");
  }
}

export const databaseService = new DatabaseService();
