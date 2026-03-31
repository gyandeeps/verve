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

  async init() {
    if (this.db) return;

    this.db = await SQLite.openDatabaseAsync("cognistaff_hub.db");

    // Initialize Schema
    await this.db.execAsync(`
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
    `);

    // Handle 30-day retention policy on boot
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    await this.db.runAsync(`DELETE FROM telemetry WHERE timestamp < ?`, [
      thirtyDaysAgo,
    ]);
    await this.db.runAsync(`DELETE FROM biometrics WHERE timestamp < ?`, [
      thirtyDaysAgo,
    ]);

    console.log("Mobile Database Initialized & Cleaned.");
  }

  async recordTelemetry(data: TelemetryData) {
    if (!this.db) await this.init();

    await this.db!.runAsync(
      `INSERT INTO telemetry (timestamp, active_app, window_title, idle_timer, churn_rate) VALUES (?, ?, ?, ?, ?)`,
      [
        data.timestamp,
        data.active_app,
        data.window_title,
        data.idle_timer,
        data.churn_rate,
      ],
    );
  }

  async recordBiometric(data: BiometricData) {
    if (!this.db) await this.init();

    await this.db!.runAsync(
      `INSERT INTO biometrics (timestamp, type, value) VALUES (?, ?, ?)`,
      [data.timestamp, data.type, data.value],
    );
  }

  async getTelemetryPaginated(
    offset: number,
    limit: number = 10,
  ): Promise<TelemetryData[]> {
    if (!this.db) await this.init();

    return await this.db!.getAllAsync<TelemetryData>(
      `SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
  }

  async getBiometricsPaginated(
    offset: number,
    limit: number = 10,
  ): Promise<BiometricData[]> {
    if (!this.db) await this.init();

    return await this.db!.getAllAsync<BiometricData>(
      `SELECT * FROM biometrics ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
  }

  async getTelemetryCount(): Promise<number> {
    if (!this.db) await this.init();
    const result = await this.db!.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM telemetry",
    );
    return result?.count ?? 0;
  }

  async getBiometricCount(): Promise<number> {
    if (!this.db) await this.init();
    const result = await this.db!.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM biometrics",
    );
    return result?.count ?? 0;
  }

  async getCombinedData(limit: number = 100, windowMs: number = 300000) {
    if (!this.db) await this.init();

    // Query for joining biometrics and telemetry based on timestamp proximity
    // Phase 1 requirement: Connect health samples with workstation focus
    return await this.db!.getAllAsync(
      `
      SELECT 
        t.active_app, 
        t.window_title, 
        t.timestamp as work_ts,
        t.churn_rate,
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
    if (!this.db) await this.init();

    await this.db!.runAsync(
      `INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)`,
      [key, value],
    );
  }

  async getMetadata(key: string): Promise<string | null> {
    if (!this.db) await this.init();

    const result = await this.db!.getFirstAsync<{ value: string }>(
      `SELECT value FROM metadata WHERE key = ?`,
      [key],
    );
    return result ? result.value : null;
  }

  /**
   * Destructive operation to reset the local database.
   * Useful for development or factory resets.
   */
  async clearAllTables() {
    if (!this.db) await this.init();

    await this.db!.execAsync(`
      DELETE FROM telemetry;
      DELETE FROM biometrics;
      DELETE FROM metadata;
      -- Reset autoincrement counters
      DELETE FROM sqlite_sequence WHERE name IN ('telemetry', 'biometrics');
    `);

    console.warn("[DatabaseService] Local database has been purged.");
  }
}

export const databaseService = new DatabaseService();
