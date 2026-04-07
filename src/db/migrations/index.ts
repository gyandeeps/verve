import * as SQLite from "expo-sqlite";
import { migration1 } from "./1-initial-schema";

export async function runMigrations(db: SQLite.SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>(
    `PRAGMA user_version`,
  );
  const currentVersion = result?.user_version ?? 0;

  console.log(
    `[DB Migrations] Current Mobile Hub DB version: ${currentVersion}`,
  );

  // Only run migration 1 if version < 1
  if (currentVersion < 1) {
    console.log("[DB Migrations] Running migration 1...");
    await migration1(db);
    await db.execAsync(`PRAGMA user_version = 1`);
    console.log("[DB Migrations] Migration 1 completed.");
  }

  console.log("[DB Migrations] Mobile Hub DB is up to date.");
}
