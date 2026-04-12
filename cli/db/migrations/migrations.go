package migrations

import (
	"database/sql"
	"fmt"
	"log"
)

type Migration struct {
	ID int
	Up func(*sql.DB) error
}

var migrationsList = []Migration{
	{ID: 1, Up: migration1},
	{ID: 2, Up: migration2},
}

func RunMigrations(db *sql.DB) error {
	var currentVersion int
	err := db.QueryRow("PRAGMA user_version").Scan(&currentVersion)
	if err != nil {
		return fmt.Errorf("failed to get user_version: %v", err)
	}

	log.Printf("[DB Migrations] Current CLI DB version: %d", currentVersion)

	for _, m := range migrationsList {
		if m.ID > currentVersion {
			log.Printf("[DB Migrations] Running migration %d...", m.ID)
			if err := m.Up(db); err != nil {
				return fmt.Errorf("migration %d failed: %v", m.ID, err)
			}
			_, err = db.Exec(fmt.Sprintf("PRAGMA user_version = %d", m.ID))
			if err != nil {
				return fmt.Errorf("failed to update user_version to %d: %v", m.ID, err)
			}
			log.Printf("[DB Migrations] Migration %d completed.", m.ID)
		}
	}

	log.Println("[DB Migrations] CLI DB is up to date.")
	return nil
}
