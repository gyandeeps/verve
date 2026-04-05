import { SQLiteDatabase } from "expo-sqlite";

export async function up(db: SQLiteDatabase) {
  // Check if column exists (guard for cross-migration runs)
  const tableInfo = (await db.getAllAsync(
    "PRAGMA table_info(telemetry)",
  )) as any[];
  const hasMachineName = tableInfo.some((col) => col.name === "machine_name");

  if (!hasMachineName) {
    await db.execAsync("ALTER TABLE telemetry ADD COLUMN machine_name TEXT;");
  }
}
