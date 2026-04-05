import { SQLiteDatabase } from "expo-sqlite";
import * as m001 from "./1-initial-schema";
import * as m002 from "./2-add-machine-name";

const migrations = [m001, m002];

export async function runMigrations(db: SQLiteDatabase) {
  // Use PRAGMA user_version to track database schema version
  const result = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const currentVersion = result?.user_version ?? 0;

  console.log(`[DB Migrations] Current version: ${currentVersion}`);

  for (let i = currentVersion; i < migrations.length; i++) {
    const version = i + 1;
    console.log(`[DB Migrations] Running migration ${version}...`);
    await migrations[i].up(db);
    await db.execAsync(`PRAGMA user_version = ${version}`);
    console.log(`[DB Migrations] Migration ${version} completed.`);
  }

  console.log("[DB Migrations] DB is up to date.");
}
