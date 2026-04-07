import * as SQLite from "expo-sqlite";

export async function migration1(db: SQLite.SQLiteDatabase) {
  // Destructive Init: The very first statement in the migration forcefully wipes the legacy schemas
  await db.execAsync(`
    DROP TABLE IF EXISTS telemetry;
    DROP TABLE IF EXISTS biometrics;
    DROP TABLE IF EXISTS hr_samples;
    DROP TABLE IF EXISTS app_categories;
    DROP TABLE IF EXISTS metadata;
  `);

  // 100% Session-Embedded Architecture
  // The phone hydrates incoming telemetry with biometrics.
  await db.execAsync(`
    CREATE TABLE telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,          -- Unix Epoch (ms)
        machine_name TEXT NOT NULL,          -- Origin workstation
        churn_rate REAL NOT NULL,            -- Context switches in 60s
        idle_timer INTEGER NOT NULL,         -- Max idle time in 60s
        sessions_data JSONB NOT NULL,        -- Optimized Binary JSON: [{app, title, duration_sec}]
        ai_state TEXT,                       -- AI-classified state (e.g., "Deep Work")
        ai_summary TEXT,                     -- LLM-generated semantic summary
        UNIQUE(timestamp, machine_name)      -- Prevent duplicate syncs across workstations
    );

    CREATE TABLE hr_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telemetry_id INTEGER NOT NULL,       -- Foreign key to telemetry.id
        ts INTEGER NOT NULL,                 -- Unix Epoch (ms) of the sample
        bpm REAL NOT NULL,                   -- Heart Rate (BPM)
        FOREIGN KEY(telemetry_id) REFERENCES telemetry(id) ON DELETE CASCADE
    );

    CREATE TABLE metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE app_categories (
        app_name TEXT PRIMARY KEY,
        category TEXT NOT NULL
    );
  `);

  console.log(
    "[Migration] Database schema version 1 (Unified Sessions) initialized.",
  );
}
