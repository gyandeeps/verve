package migrations

import (
	"database/sql"
	"fmt"
)

func migration1(db *sql.DB) error {
	// Destructive Init: forceful wipe of legacy schemas
	dropOldTables := []string{
		"DROP TABLE IF EXISTS telemetry_history;",
		"DROP TABLE IF EXISTS telemetry_outbox;",
		"DROP TABLE IF EXISTS telemetry;",
	}

	for _, stmt := range dropOldTables {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("failed to drop old tables: %v", err)
		}
	}

	createTelemetryTable := `
	CREATE TABLE telemetry (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		start_timestamp INTEGER NOT NULL,    -- Unix Epoch (ms)
		end_timestamp INTEGER NOT NULL,      -- Unix Epoch (ms)
		machine_name TEXT NOT NULL,          -- Hostname
		churn_rate REAL NOT NULL,            -- Context switches in 120s
		idle_timer INTEGER NOT NULL,         -- Max idle time in 120s
		sessions_data JSONB NOT NULL,        -- Optimized Binary JSON: [{app, title, duration_sec}]
		status TEXT DEFAULT 'PENDING'        -- 'PENDING', 'SYNCED' (Outbox State)
	);`

	_, err := db.Exec(createTelemetryTable)
	return err
}
