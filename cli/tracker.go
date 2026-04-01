package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"os/exec"
	"time"

	"verve-cli/db"
)

type Telemetry struct {
	Timestamp   int64   `json:"timestamp"`
	ActiveApp   string  `json:"active_app"`
	WindowTitle string  `json:"window_title"`
	IdleTimer   int     `json:"idle_timer"`
	ChurnRate   float64 `json:"churn_rate"`
}

func startTracker(database *sql.DB, intervalSec int) {
	ticker := time.NewTicker(time.Duration(intervalSec) * time.Second)
	defer ticker.Stop()

	var lastApp string
	var appChanges int
	startTime := time.Now()

	for {
		// Execute self as a fresh subprocess to bypass macOS WindowServer caching
		cmd := exec.Command(os.Args[0], "--telemetry-helper")
		out, err := cmd.Output()

		var appName, winTitle string
		var idleTime int

		if err == nil {
			var helperData Telemetry
			if err := json.Unmarshal(out, &helperData); err == nil {
				appName = helperData.ActiveApp
				winTitle = helperData.WindowTitle
				idleTime = helperData.IdleTimer
			}
		}

		if lastApp != "" && appName != "" && appName != lastApp {
			appChanges++
		}
		if appName != "" {
			lastApp = appName
		}

		elapsedMinutes := time.Since(startTime).Minutes()
		var churnRate float64
		if elapsedMinutes > 0 {
			churnRate = float64(appChanges) / elapsedMinutes
		}
		timestamp := time.Now().UnixMilli()

		payload := Telemetry{
			Timestamp:   timestamp,
			ActiveApp:   appName,
			WindowTitle: winTitle,
			IdleTimer:   idleTime,
			ChurnRate:   churnRate,
		}

		jsonData, err := json.Marshal(payload)
		if err == nil {
			err = db.RecordTelemetry(database, timestamp, appName, winTitle, idleTime, churnRate, string(jsonData))
			if err != nil {
				log.Printf("Failed to record telemetry locally: %v", err)
			}
			log.Printf("Telemetry recorded! Timestamp: %d, App: %s, Title: %s, Idle: %ds, Churn: %.2f/min\n", timestamp, appName, winTitle, idleTime, churnRate)
		}

		<-ticker.C
	}
}
