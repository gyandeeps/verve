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
  type: "HRV" | "HR";
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
    `);

    // Handle 30-day retention policy on boot
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    await this.db.runAsync(`DELETE FROM telemetry WHERE timestamp < ?`, [thirtyDaysAgo]);
    await this.db.runAsync(`DELETE FROM biometrics WHERE timestamp < ?`, [thirtyDaysAgo]);

    console.log("Mobile Database Initialized & Cleaned.");
  }

  async recordTelemetry(data: TelemetryData) {
    if (!this.db) await this.init();

    await this.db!.runAsync(
      `INSERT INTO telemetry (timestamp, active_app, window_title, idle_timer, churn_rate) VALUES (?, ?, ?, ?, ?)`,
      [data.timestamp, data.active_app, data.window_title, data.idle_timer, data.churn_rate]
    );
  }

  async recordBiometric(data: BiometricData) {
    if (!this.db) await this.init();

    await this.db!.runAsync(
      `INSERT INTO biometrics (timestamp, type, value) VALUES (?, ?, ?)`,
      [data.timestamp, data.type, data.value]
    );
  }

  async getTelemetryPaginated(offset: number, limit: number = 10): Promise<TelemetryData[]> {
    if (!this.db) await this.init();

    return await this.db!.getAllAsync<TelemetryData>(
      `SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  }

  async getCombinedData(limit: number = 100) {

    if (!this.db) await this.init();

    // Query for joining biometrics and telemetry based on timestamp proximity
    // Phase 1 requirement: Connect health samples with workstation focus
    return await this.db!.getAllAsync(`
      SELECT 
        t.active_app, 
        t.window_title, 
        t.timestamp as work_ts,
        b.type,
        b.value,
        b.timestamp as bio_ts
      FROM telemetry t
      LEFT JOIN biometrics b ON ABS(t.timestamp - b.timestamp) < 60000 -- 1 minute window
      ORDER BY t.timestamp DESC
      LIMIT ?
    `, [limit]);
  }
}

export const databaseService = new DatabaseService();
