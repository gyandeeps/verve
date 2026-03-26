package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/grandcat/zeroconf"
)

type Telemetry struct {
	Timestamp int64  `json:"timestamp"`
	ActiveApp string `json:"active_app"`
	IdleTimer int    `json:"idle_timer"`
}

func sendTelemetry(targetIP string) {
	// Define the address (Phone IP + Port)
	address := fmt.Sprintf("%s:8082", targetIP)

	conn, err := net.DialTimeout("tcp", address, 5*time.Second)
	if err != nil {
		log.Printf("Failed to connect to Mobile Hub: %v", err)
		return
	}
	defer conn.Close()
	log.Printf("Successfully connected to Mobile Hub at %s", address)

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		// Create dummy data
		payload := Telemetry{
			Timestamp: time.Now().UnixMilli(),
			ActiveApp: "VS Code",
			IdleTimer: 0,
		}

		jsonData, _ := json.Marshal(payload)
		_, err = conn.Write(jsonData)
		if err != nil {
			log.Println("Mobile App disconnected. Stopping telemetry.")
			break
		} else {
			log.Println("Telemetry/heartbeat sent successfully!")
		}

		<-ticker.C
	}
}

func main() {
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
