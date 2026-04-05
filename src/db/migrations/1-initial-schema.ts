import { SQLiteDatabase } from "expo-sqlite";

export async function up(db: SQLiteDatabase) {
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
}
