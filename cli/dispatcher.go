package main

import (
	"database/sql"
	"fmt"
	"log"
	"net"
	"time"

	"cognistaff-cli/db"
)

func sendTelemetry(targetIP string, database *sql.DB) {
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

	for {
		msgs, err := db.GetPendingMessages(database, 10)
		if err != nil {
			log.Printf("Failed to fetch pending outbox rows: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		if len(msgs) == 0 {
			time.Sleep(1 * time.Second)
			continue
		}

		for _, msg := range msgs {
			// Write the payload with a newline delimiter to assist JSON stream parsing
			_, err = conn.Write([]byte(msg.Payload + "\n"))
			if err != nil {
				log.Println("Mobile App disconnected. Halting outbox dispatcher.")
				return
			}
			
			// Note: As specified in Phase 1 specs, rows are only deleted upon COMMIT_SUCCESS. 
			// We simulate standard TCP delivery success for now by deleting upon Write success.
			db.MarkDelivered(database, msg.ID)
			log.Printf("Outbox [Delivered]: MsgID %d -> App: %v", msg.ID, "Mobile Hub")
		}
		
		time.Sleep(100 * time.Millisecond) // Yield briefly gracefully
	}
}
