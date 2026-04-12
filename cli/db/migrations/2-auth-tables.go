package migrations

import (
	"database/sql"
)

func migration2(db *sql.DB) error {
	createConfigTable := `
	CREATE TABLE config (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);`

	createAuthTokensTable := `
	CREATE TABLE auth_tokens (
		token TEXT PRIMARY KEY,
		device_name TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	if _, err := db.Exec(createConfigTable); err != nil {
		return err
	}
	if _, err := db.Exec(createAuthTokensTable); err != nil {
		return err
	}
	return nil
}
