package migrations

import (
	"database/sql"
)

func migration2(db *sql.DB) error {
	// Check if column exists first
	rows, err := db.Query("PRAGMA table_info(telemetry_history)")
	if err != nil {
		return err
	}
	defer rows.Close()

	hasMachineName := false
	for rows.Next() {
		var cid int
		var name, dtype string
		var notnull, pk int
		var dflt_value interface{}
		if err := rows.Scan(&cid, &name, &dtype, &notnull, &dflt_value, &pk); err == nil {
			if name == "machine_name" {
				hasMachineName = true
				break
			}
		}
	}

	if !hasMachineName {
		_, err = db.Exec("ALTER TABLE telemetry_history ADD COLUMN machine_name TEXT")
		return err
	}
	return nil
}
