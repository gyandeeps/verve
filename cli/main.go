package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"cognistaff-cli/telemetry"

	"github.com/grandcat/zeroconf"
)

type Telemetry struct {
	Timestamp   int64   `json:"timestamp"`
	ActiveApp   string  `json:"active_app"`
	WindowTitle string  `json:"window_title"`
	IdleTimer   int     `json:"idle_timer"`
	ChurnRate   float64 `json:"churn_rate"`
}

func sendTelemetry(targetIP string) {
	// react-native-tcp-socket on iOS has a known bug where it crashes (nil insertion)
	// when a client connects via IPv6. Force IPv4.
	if targetIP == "::1" || targetIP == "localhost" {
		targetIP = "127.0.0.1"
	}
	
	address := fmt.Sprintf("%s:8082", targetIP)

	// Force tcp4 network to prevent IPv6 crash on the mobile hub
	conn, err := net.DialTimeout("tcp4", address, 5*time.Second)
	if err != nil {
		log.Printf("Failed to connect to Mobile Hub: %v", err)
		return
	}
	defer conn.Close()
	log.Printf("Successfully connected to Mobile Hub at %s", address)

	ticker := time.NewTicker(5 * time.Second)
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

		jsonData, _ := json.Marshal(payload)
		_, err = conn.Write(jsonData)
		if err != nil {
			log.Println("Mobile App disconnected. Stopping telemetry.")
			break
		} else {
			log.Printf("Telemetry sent! Timestamp: %d, App: %s, Title: %s, Idle: %ds, Churn: %.2f/min\n", timestamp, appName, winTitle, idleTime, churnRate)
		}

		<-ticker.C
	}
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--telemetry-helper" {
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
			go sendTelemetry(host)
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
