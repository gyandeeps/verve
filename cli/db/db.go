package db

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"verve-cli/db/migrations"

	_ "github.com/mattn/go-sqlite3"
)

type OutboxMessage struct {
	ID      int64
	Payload string
}

const (
	// FORCE_RESET: Set to true only in development to wipe the version and re-run migrations
	FORCE_RESET = false
)

func InitDB(dbPath string) (*sql.DB, error) {
	database, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if FORCE_RESET {
		log.Println("[DEV] Forcing migration reset (user_version = 0)...")
		_, err = database.Exec("PRAGMA user_version = 0")
		if err != nil {
			log.Printf("[DEV] Reset failed: %v", err)
		}
	}

	// Use versioned migrations
	if err := migrations.RunMigrations(database); err != nil {
		return nil, fmt.Errorf("failed to run database migrations: %v", err)
	}

	// 30-Day Rolling Cleanup (All Nodes)
	// Prune successfully synced telemetry records older than 30 days
	thirtyDaysAgo := time.Now().Add(-30 * 24 * time.Hour).UnixMilli()
	cleanupQuery := `DELETE FROM telemetry WHERE status = 'SYNCED' AND timestamp < ?`
	if _, err := database.Exec(cleanupQuery, thirtyDaysAgo); err != nil {
		log.Printf("Warning: Failed to clean up old synced telemetry history: %v", err)
	}

	return database, nil
}

// RecordTelemetry stores high-density session data in the primary telemetry table
func RecordTelemetry(db *sql.DB, timestamp int64, machineName string, churnRate float64, maxIdleTime int, payloadJSON string) error {
	query := `INSERT INTO telemetry (timestamp, machine_name, churn_rate, idle_timer, sessions_data, status) VALUES (?, ?, ?, ?, ?, 'PENDING')`
	_, err := db.Exec(query, timestamp, machineName, churnRate, maxIdleTime, payloadJSON)
	return err
}

// GetPendingMessages retrieves un-dispatched messages (status = 'PENDING')
func GetPendingMessages(db *sql.DB, limit int) ([]OutboxMessage, error) {
	rows, err := db.Query(`SELECT id, sessions_data FROM telemetry WHERE status = 'PENDING' ORDER BY id ASC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []OutboxMessage
	for rows.Next() {
		var msg OutboxMessage
		if err := rows.Scan(&msg.ID, &msg.Payload); err != nil {
			log.Printf("Error scanning outbox row: %v", err)
			continue
		}
		messages = append(messages, msg)
	}
	return messages, nil
}

// MarkDelivered updates the status to 'SYNCED' once successfully transmitted
func MarkDelivered(db *sql.DB, id int64) error {
	_, err := db.Exec(`UPDATE telemetry SET status = 'SYNCED' WHERE id = ?`, id)
	return err
}

// PrintDBSummary logs the current state of the database to stdout on bootup.
func PrintDBSummary(db *sql.DB) {
	var totalCount int
	err := db.QueryRow(`SELECT COUNT(*) FROM telemetry`).Scan(&totalCount)
	if err != nil {
		log.Printf("Failed to count telemetry records: %v", err)
	}

	var pendingCount int
	err = db.QueryRow(`SELECT COUNT(*) FROM telemetry WHERE status = 'PENDING'`).Scan(&pendingCount)
	if err != nil {
		log.Printf("Failed to count pending outbox records: %v", err)
	}

	log.Printf("DB Summary: %d total telemetry records. %d records pending sync.", totalCount, pendingCount)
}
