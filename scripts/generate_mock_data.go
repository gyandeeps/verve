package main

import (
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// SessionBlock matches the structure in src/db/DatabaseService.ts
type SessionBlock struct {
	App         string `json:"app"`
	Title       string `json:"title"`
	DurationSec int    `json:"duration_sec"`
}

var (
	apps   = []string{"VS Code", "Slack", "Chrome", "Terminal", "Figma", "Zoom", "Discord", "Spotify"}
	titles = []string{"Working on feature X", "Meeting with team", "Researching API", "Debugging crash", "Designing mockup", "Listening to focus music"}
)

func main() {
	count := flag.Int("count", 50, "Number of telemetry entries to generate")
	hrCount := flag.Int("hr-count", 2, "Number of heart rate samples per entry")
	dbPath := flag.String("db", "verve_hub.db", "Path to the mobile SQLite database")
	flag.Parse()

	db, err := sql.Open("sqlite3", *dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	// Ensure tables exist matching src/db/migrations/1-initial-schema.ts
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS telemetry (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			start_timestamp INTEGER NOT NULL,
			end_timestamp INTEGER NOT NULL,
			machine_name TEXT NOT NULL,
			churn_rate REAL NOT NULL,
			idle_timer INTEGER NOT NULL,
			sessions_data TEXT NOT NULL,
			ai_state TEXT,
			ai_summary TEXT,
			UNIQUE(start_timestamp, machine_name)
		);
		CREATE TABLE IF NOT EXISTS hr_samples (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			telemetry_id INTEGER NOT NULL,
			ts INTEGER NOT NULL,
			bpm REAL NOT NULL,
			FOREIGN KEY(telemetry_id) REFERENCES telemetry(id) ON DELETE CASCADE
		);
	`)
	if err != nil {
		log.Fatalf("Failed to ensure tables exist: %v", err)
	}

	machineName, _ := os.Hostname()
	if machineName == "" {
		machineName = "Mock-Workstation"
	}

	now := time.Now().UnixMilli()
	windowSize := int64(120000) // 120 seconds

	fmt.Printf("🧪 Preparing to generate %d telemetry records...\n", *count)
	fmt.Printf("📂 Database Location: %s\n", *dbPath)

	telemetryInjected := 0
	hrInjected := 0

	for i := 0; i < *count; i++ {
		startTs := now - int64(i)*windowSize
		endTs := startTs + windowSize

		// Generate random session blocks
		numSessions := rand.Intn(3) + 1
		sessions := make([]SessionBlock, numSessions)
		for s := 0; s < numSessions; s++ {
			sessions[s] = SessionBlock{
				App:         apps[rand.Intn(len(apps))],
				Title:       titles[rand.Intn(len(titles))],
				DurationSec: 120 / numSessions,
			}
		}

		churnRate := float64(numSessions - 1)
		idleTimer := rand.Intn(15) // 0-15s idle

		jsonData, _ := json.Marshal(sessions)

		// Insert telemetry
		result, err := db.Exec(`INSERT OR IGNORE INTO telemetry 
			(start_timestamp, end_timestamp, machine_name, churn_rate, idle_timer, sessions_data) 
			VALUES (?, ?, ?, ?, ?, ?)`,
			startTs, endTs, machineName, churnRate, idleTimer, string(jsonData))

		if err != nil {
			log.Printf("Failed to insert telemetry %d: %v", i, err)
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			continue // Skip if duplicate
		}

		telemetryInjected++
		telemetryID, _ := result.LastInsertId()

		// Insert HR samples
		for h := 0; h < *hrCount; h++ {
			sampleTs := startTs + int64(rand.Intn(120000))
			bpm := 60 + rand.Float64()*40 // 60 to 100 BPM

			_, err = db.Exec(`INSERT INTO hr_samples (telemetry_id, ts, bpm) VALUES (?, ?, ?)`,
				telemetryID, sampleTs, bpm)
			if err != nil {
				log.Printf("Failed to insert HR sample for telemetry %d: %v", telemetryID, err)
			} else {
				hrInjected++
			}
		}
	}

	fmt.Println("\n✨ Mock Data Generation Summary")
	fmt.Println("-------------------------------")
	fmt.Printf("✅ Telemetry Records: %d\n", telemetryInjected)
	fmt.Printf("✅ Heart Rate Samples: %d\n", hrInjected)
	fmt.Printf("📂 Database: %s\n", *dbPath)
	fmt.Println("-------------------------------")
}
