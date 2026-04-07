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

type SessionBlock struct {
	App         string `json:"app"`
	Title       string `json:"title"`
	DurationSec int    `json:"duration_sec"`
}

type Telemetry struct {
	StartTimestamp int64          `json:"start_timestamp"`
	EndTimestamp   int64          `json:"end_timestamp"`
	MachineName    string         `json:"machine_name"`
	ChurnRate      float64        `json:"churn_rate"`
	IdleTimer      int            `json:"idle_timer"`
	SessionsData   []SessionBlock `json:"sessions_data"`
}

type HelperTelemetry struct {
	ActiveApp   string `json:"active_app"`
	WindowTitle string `json:"window_title"`
	IdleTimer   int    `json:"idle_timer"`
}

func startTracker(database *sql.DB, intervalSec int) {
	ticker := time.NewTicker(time.Duration(intervalSec) * time.Second)
	defer ticker.Stop()

	machineName, _ := os.Hostname()

	// Accumulators for the 120s window
	var currentSessions []SessionBlock
	var lastApp string
	var lastTitle string
	var appChanges int
	var maxIdleTime int
	var pollCount int

	reportingThreshold := REPORTING_WINDOW_SECONDS / intervalSec
	if reportingThreshold < 1 {
		reportingThreshold = 1
	}

	windowStartTime := time.Now().UnixMilli()

	for {
		pollCount++

		if pollCount == 1 {
			windowStartTime = time.Now().UnixMilli()
		}

		// Execute self as a fresh subprocess to bypass macOS WindowServer caching
		cmd := exec.Command(os.Args[0], "--telemetry-helper")
		out, err := cmd.Output()

		var appName, winTitle string
		var idleTime int

		if err == nil {
			var helperData struct {
				ActiveApp   string `json:"active_app"`
				WindowTitle string `json:"window_title"`
				IdleTimer   int    `json:"idle_timer"`
			}
			if err := json.Unmarshal(out, &helperData); err == nil {
				appName = helperData.ActiveApp
				winTitle = helperData.WindowTitle
				idleTime = helperData.IdleTimer
			}
		}

		// 1. Churn Tracking (Context Switches)
		if lastApp != "" && appName != "" && appName != lastApp {
			appChanges++
		}

		// 2. Idle Tracking
		if idleTime > maxIdleTime {
			maxIdleTime = idleTime
		}

		// 3. Session Compression (RLE)
		if appName == lastApp && winTitle == lastTitle && len(currentSessions) > 0 {
			// Increment duration of the last block
			currentSessions[len(currentSessions)-1].DurationSec += intervalSec
		} else {
			// New block
			currentSessions = append(currentSessions, SessionBlock{
				App:         appName,
				Title:       winTitle,
				DurationSec: intervalSec,
			})
		}

		lastApp = appName
		lastTitle = winTitle

		// 4. Reporting Window (Flush every 120s)
		if pollCount >= reportingThreshold {
			// Calculate churn rate for this 60s period
			churnRate := float64(appChanges) // Switches per 120s
			windowEndTime := time.Now().UnixMilli()

			payload := Telemetry{
				StartTimestamp: windowStartTime,
				EndTimestamp:   windowEndTime,
				MachineName:    machineName,
				ChurnRate:      churnRate,
				IdleTimer:      maxIdleTime,
				SessionsData:   currentSessions,
			}

			jsonData, err := json.Marshal(payload)
			if err == nil {
				err = db.RecordTelemetry(database, windowStartTime, windowEndTime, machineName, churnRate, maxIdleTime, string(jsonData))
				if err != nil {
					log.Printf("Failed to record telemetry locally: %v", err)
				}
				log.Printf("120s Telemetry Flushed! START: %d, END: %d, Churn: %.1f, Sessions: %d\n", windowStartTime, windowEndTime, churnRate, len(currentSessions))
			}

			// Reset window accumulators
			pollCount = 0
			appChanges = 0
			maxIdleTime = 0
			currentSessions = []SessionBlock{}
		}

		<-ticker.C
	}
}
