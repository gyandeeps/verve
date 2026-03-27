package db

import (
	"database/sql"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type OutboxMessage struct {
	ID      int64
	Payload string
}

func InitDB(dbPath string) (*sql.DB, error) {
	database, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	createMainTable := `
	CREATE TABLE IF NOT EXISTS telemetry_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp INTEGER NOT NULL,
		active_app TEXT NOT NULL,
		window_title TEXT,
		idle_timer INTEGER,
		churn_rate REAL
	);`
	if _, err := database.Exec(createMainTable); err != nil {
		return nil, err
	}

	createOutboxTable := `
	CREATE TABLE IF NOT EXISTS telemetry_outbox (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		payload TEXT NOT NULL,
		status TEXT DEFAULT 'PENDING'
	);`
	if _, err := database.Exec(createOutboxTable); err != nil {
		return nil, err
	}

	// Clean up records older than 30 days in the telemetry history table
	thirtyDaysAgo := time.Now().Add(-30 * 24 * time.Hour).UnixMilli()
	cleanupQuery := `DELETE FROM telemetry_history WHERE timestamp < ?`
	if _, err := database.Exec(cleanupQuery, thirtyDaysAgo); err != nil {
		log.Printf("Warning: Failed to clean up old telemetry history: %v", err)
	}

	return database, nil
}

// RecordTelemetry performs the two required writes in a single, atomic database transaction.
func RecordTelemetry(db *sql.DB, timestamp int64, app, title string, idleTime int, churnRate float64, payloadJSON string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}

	_, err = tx.Exec(`INSERT INTO telemetry_history (timestamp, active_app, window_title, idle_timer, churn_rate) VALUES (?, ?, ?, ?, ?)`,
		timestamp, app, title, idleTime, churnRate)
	if err != nil {
		tx.Rollback()
		return err
	}

	_, err = tx.Exec(`INSERT INTO telemetry_outbox (payload, status) VALUES (?, 'PENDING')`, payloadJSON)
	if err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}

// GetPendingMessages retrieves un-dispatched messages ordered by creation time.
func GetPendingMessages(db *sql.DB, limit int) ([]OutboxMessage, error) {
	rows, err := db.Query(`SELECT id, payload FROM telemetry_outbox WHERE status = 'PENDING' ORDER BY id ASC LIMIT ?`, limit)
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

// MarkDelivered safely deletes a message from the outbox entirely upon successful transmission logic.
func MarkDelivered(db *sql.DB, id int64) error {
	_, err := db.Exec(`DELETE FROM telemetry_outbox WHERE id = ?`, id)
	return err
}

// PrintDBSummary logs the current state of the database to stdout on bootup.
func PrintDBSummary(db *sql.DB) {
	var historyCount int
	err := db.QueryRow(`SELECT COUNT(*) FROM telemetry_history`).Scan(&historyCount)
	if err != nil {
		log.Printf("Failed to count history records: %v", err)
	}

	var pendingCount int
	err = db.QueryRow(`SELECT COUNT(*) FROM telemetry_outbox WHERE status = 'PENDING'`).Scan(&pendingCount)
	if err != nil {
		log.Printf("Failed to count pending outbox records: %v", err)
	}

	log.Printf("DB Summary: %d total history records recorded. %d records pending sync.", historyCount, pendingCount)
}
