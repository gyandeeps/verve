package migrations

import (
	"database/sql"
)

func migration1(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS telemetry_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp INTEGER NOT NULL,
			active_app TEXT NOT NULL,
			window_title TEXT,
			idle_timer INTEGER,
			churn_rate REAL
		);
		CREATE TABLE IF NOT EXISTS telemetry_outbox (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			payload TEXT NOT NULL,
			status TEXT DEFAULT 'PENDING'
		);
	`)
	return err
}
