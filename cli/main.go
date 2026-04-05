package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"

	"verve-cli/db"
	"verve-cli/telemetry"

	"github.com/grandcat/zeroconf"
)

const (
	DEFAULT_POLLING_INTERVAL = 20
	SERVICE_PORT             = 8088
	SERVICE_NAME             = "Verve-Workstation"
	SERVICE_TYPE             = "_verve._tcp"
	DB_NAME                  = "verve.db"
)

// Version is set at build time via -ldflags "-X main.Version=v0.0.1"
var Version = "dev"

// shutdownChan is used to signal all active goroutines to stop
var shutdownChan = make(chan struct{})

func main() {
	versionFlag := flag.Bool("version", false, "Print version and exit")
	helperFlag := flag.Bool("telemetry-helper", false, "Run as short-lived helper")
	intervalFlag := flag.Int("interval", DEFAULT_POLLING_INTERVAL, "Polling interval in seconds")
	flag.Parse()

	if *versionFlag {
		fmt.Println("verve-cli", Version)
		os.Exit(0)
	}

	if *helperFlag {
		// Run as a short-lived helper to guarantee fresh WindowServer connection
		appName, winTitle, idleTime := telemetry.GetSystemTelemetry()
		machineName, _ := os.Hostname()
		out := Telemetry{
			ActiveApp:   appName,
			WindowTitle: winTitle,
			IdleTimer:   idleTime,
			MachineName: machineName,
		}
		json.NewEncoder(os.Stdout).Encode(out)
		os.Exit(0)
	}

	database, err := db.InitDB(DB_NAME)
	if err != nil {
		log.Fatalf("Failed to initialize SQLite database: %v", err)
	}

	// Print database health stats to console
	db.PrintDBSummary(database)

	intervalSec := DEFAULT_POLLING_INTERVAL
	if *intervalFlag > 0 {
		intervalSec = *intervalFlag
	} else if envVal := os.Getenv("TRACKER_INTERVAL_SEC"); envVal != "" {
		if parsed, err := strconv.Atoi(envVal); err == nil && parsed > 0 {
			intervalSec = parsed
		}
	}

	go startTracker(database, intervalSec)

	// Determine dynamic service name based on hostname
	// Ensure we maintain a clean name for mDNS discovery (avoiding spaces/parentheses)
	dynamicServiceName := SERVICE_NAME
	if host, err := os.Hostname(); err == nil && host != "" {
		// Remove .local or other suffixes and sanitize special characters
		cleanHost := strings.Split(host, ".")[0]
		cleanHost = strings.Map(func(r rune) rune {
			if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
				return r
			}
			return '-'
		}, cleanHost)
		dynamicServiceName = fmt.Sprintf("Verve-%s", cleanHost)
	}

	// Register the Verve service
	server, err := zeroconf.Register(dynamicServiceName, SERVICE_TYPE, "local.", SERVICE_PORT, []string{"txtv=0", "lo=1"}, nil)
	if err != nil {
		log.Fatalf("Failed to register mDNS service: %v", err)
	}

	log.Println("Shadow CLI: mDNS service registered as", dynamicServiceName, "on port", SERVICE_PORT)
	log.Println("Press Ctrl+C to stop...")

	// Start a TCP server to listen for actual connections from the app
	go func() {
		listener, err := net.Listen("tcp", ":"+strconv.Itoa(SERVICE_PORT))
		if err != nil {
			log.Fatalf("Failed to start TCP server on port %d: %v", SERVICE_PORT, err)
		}
		defer listener.Close()

		for {
			conn, err := listener.Accept()
			if err != nil {
				log.Printf("Failed to accept connection: %v", err)
				continue
			}
			go sendTelemetry(conn, database)
		}
	}()

	// Wait for termination signal
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	<-sig

	log.Println("Shutting down Shadow CLI...")
	close(shutdownChan) // Signal all active streams to stop
	server.Shutdown()
	database.Close()
	os.Exit(0)
}
