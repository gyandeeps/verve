import { SQLiteDatabase } from "expo-sqlite";

export async function up(db: SQLiteDatabase) {
  // 1. ADD UNIQUE INDEX on biometrics(timestamp, type)
  // 2. We use 'UNIQUE' so that INSERT OR IGNORE works correctly.
  // Note: If there are existing duplicates, 'CREATE UNIQUE INDEX' might fail.
  // We'll use a cleanup step first.

  await db.execAsync(`
    -- Cleanup duplicates first (keep the one with smallest id)
    DELETE FROM biometrics 
    WHERE id NOT IN (
      SELECT MIN(id) 
      FROM biometrics 
      GROUP BY timestamp, type
    );

    -- Now create the unique index
    CREATE UNIQUE INDEX IF NOT EXISTS idx_biometric_unique_ts_type 
    ON biometrics(timestamp, type);
  `);
}
