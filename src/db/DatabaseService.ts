import * as SQLite from "expo-sqlite";

export type TelemetryData = {
  timestamp: number;
  active_app: string;
  window_title: string;
  idle_timer: number;
  churn_rate: number;
};

export type BiometricData = {
  timestamp: number;
  type: "HR";
  value: number;
};

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  async init(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync("verve_hub.db");

        // Initialize Schema
        await db.execAsync(`
          PRAGMA journal_mode = WAL;
          
          CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            active_app TEXT NOT NULL,
            window_title TEXT,
            idle_timer INTEGER,
            churn_rate REAL
          );

          CREATE TABLE IF NOT EXISTS biometrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            type TEXT NOT NULL,
            value REAL NOT NULL
          );

          -- Indexing for high-speed JOIN operations as per Phase 1 specs
          CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry(timestamp);
          CREATE INDEX IF NOT EXISTS idx_biometrics_ts ON biometrics(timestamp);

          CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT
          );

          CREATE TABLE IF NOT EXISTS app_categories (
            app_name TEXT PRIMARY KEY,
            category TEXT NOT NULL
          );
        `);

        // Handle 30-day retention policy on boot
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        await db.runAsync(`DELETE FROM telemetry WHERE timestamp < ?`, [
          thirtyDaysAgo,
        ]);
        await db.runAsync(`DELETE FROM biometrics WHERE timestamp < ?`, [
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

  async recordTelemetry(data: TelemetryData) {
    const db = await this.init();

    await db.runAsync(
      `INSERT INTO telemetry (timestamp, active_app, window_title, idle_timer, churn_rate) VALUES (?, ?, ?, ?, ?)`,
      [
        data.timestamp,
        data.active_app,
        data.window_title ?? null,
        data.idle_timer ?? null,
        data.churn_rate ?? null,
      ],
    );
  }

  async recordBiometric(data: BiometricData) {
    const db = await this.init();

    await db.runAsync(
      `INSERT INTO biometrics (timestamp, type, value) VALUES (?, ?, ?)`,
      [data.timestamp, data.type, data.value ?? 0],
    );
  }

  async getTelemetryPaginated(
    offset: number,
    limit: number = 10,
  ): Promise<TelemetryData[]> {
    const db = await this.init();

    return await db.getAllAsync<TelemetryData>(
      `SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
  }

  async getTelemetryInRange(
    startTime: number,
    endTime: number,
  ): Promise<TelemetryData[]> {
    const db = await this.init();

    return await db.getAllAsync<TelemetryData>(
      `SELECT * FROM telemetry WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC`,
      [startTime, endTime],
    );
  }

  async getBiometricsPaginated(
    offset: number,
    limit: number = 10,
  ): Promise<BiometricData[]> {
    const db = await this.init();

    return await db.getAllAsync<BiometricData>(
      `SELECT * FROM biometrics ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
  }

  async getTelemetryCount(): Promise<number> {
    const db = await this.init();
    const result = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM telemetry",
    );
    return result?.count ?? 0;
  }

  async getBiometricCount(): Promise<number> {
    const db = await this.init();
    const result = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM biometrics",
    );
    return result?.count ?? 0;
  }

  async getCombinedData(limit: number = 100, windowMs: number = 300000) {
    const db = await this.init();

    // Query for joining biometrics and telemetry based on timestamp proximity
    // Phase 1 requirement: Connect health samples with workstation focus
    return await db.getAllAsync(
      `
      SELECT 
        t.active_app, 
        t.window_title, 
        t.timestamp as work_ts,
        t.churn_rate,
        t.idle_timer,
        b.type,
        b.value,
        b.timestamp as bio_ts
      FROM telemetry t
      LEFT JOIN biometrics b ON ABS(t.timestamp - b.timestamp) < ?
      ORDER BY t.timestamp DESC
      LIMIT ?
    `,
      [windowMs, limit],
    );
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

  async getAppCategory(appName: string): Promise<string | null> {
    const db = await this.init();

    const result = await db.getFirstAsync<{ category: string }>(
      `SELECT category FROM app_categories WHERE app_name = ?`,
      [appName],
    );
    return result ? result.category : null;
  }

  async setAppCategory(appName: string, category: string) {
    const db = await this.init();

    // Defensive check: ensure SQLite receives strings, not objects/undefined
    const cleanApp = String(appName || "");
    const cleanCat =
      typeof category === "string" ? category : String(category || "Unknown");

    await db.runAsync(
      `INSERT OR REPLACE INTO app_categories (app_name, category) VALUES (?, ?)`,
      [cleanApp, cleanCat],
    );
  }

  /**
   * Destructive operation to reset the local database.
   * Useful for development or factory resets.
   */
  async clearAllTables() {
    const db = await this.init();

    await db.execAsync(`
      DELETE FROM telemetry;
      DELETE FROM biometrics;
      DELETE FROM metadata;
      DELETE FROM app_categories;
      -- Reset autoincrement counters
      DELETE FROM sqlite_sequence WHERE name IN ('telemetry', 'biometrics');
    `);

    console.warn("[DatabaseService] Local database has been purged.");
  }
}

export const databaseService = new DatabaseService();
