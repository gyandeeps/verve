package main

import (
	"encoding/json"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"cognistaff-cli/db"
	"cognistaff-cli/telemetry"

	"github.com/grandcat/zeroconf"
)

func main() {
	helperFlag := flag.Bool("telemetry-helper", false, "Run as short-lived helper")
	intervalFlag := flag.Int("interval", 0, "Polling interval in seconds")
	flag.Parse()

	if *helperFlag {
		// Run as a short-lived helper to guarantee fresh WindowServer connection
		appName, winTitle, idleTime := telemetry.GetSystemTelemetry()
		out := Telemetry{
			ActiveApp:   appName,
			WindowTitle: winTitle,
			IdleTimer:   idleTime,
		}
		json.NewEncoder(os.Stdout).Encode(out)
		os.Exit(0)
	}

	database, err := db.InitDB("cognistaff.db")
	if err != nil {
		log.Fatalf("Failed to initialize SQLite database: %v", err)
	}

	// Print database health stats to console
	db.PrintDBSummary(database)

	intervalSec := 10 // default to 10 seconds
	if *intervalFlag > 0 {
		intervalSec = *intervalFlag
	} else if envVal := os.Getenv("TRACKER_INTERVAL_SEC"); envVal != "" {
		if parsed, err := strconv.Atoi(envVal); err == nil && parsed > 0 {
			intervalSec = parsed
		}
	}

	go startTracker(database, intervalSec)

	port := 8088
	// Register the CogniStaff service on port 8088
	server, err := zeroconf.Register("CogniStaff-Workstation", "_cognistaff._tcp", "local.", port, []string{"txtv=0", "lo=1"}, nil)
	if err != nil {
		log.Fatalf("Failed to register mDNS service: %v", err)
	}
	defer server.Shutdown()

	log.Println("Shadow CLI: mDNS service registered as 'CogniStaff-Workstation' on port ", port)
	log.Println("Press Ctrl+C to stop...")

	// Start an HTTP server to listen for actual connection pings from the app
	go func() {
		http.HandleFunc("/connect", func(w http.ResponseWriter, r *http.Request) {
			host, _, err := net.SplitHostPort(r.RemoteAddr)
			if err != nil {
				host = r.RemoteAddr
			}
			if host == "::1" {
				host = "127.0.0.1"
			}
			log.Printf("Device connected from %s", host)
			w.WriteHeader(http.StatusOK)
			go sendTelemetry(host, database)
		})

		err := http.ListenAndServe(":"+strconv.Itoa(port), nil)
		if err != nil {
			log.Printf("Failed to start HTTP server on port %d: %v", port, err)
		}
	}()

	// Wait for termination signal
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	<-sig

	log.Println("Shutting down Shadow CLI...")
}
