package main

import (
	"database/sql"
	"fmt"
	"log"
	"net"
	"time"

	"verve-cli/db"
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
		log.Printf("Sync [Network Error]: Failed to connect to Mobile Hub at %s: %v", address, err)
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
			
			// TODO: (Phase 1 Optimization) Implement ACK-based handshake.
			// Currently, we assume success upon Write. In a future version, we should wait for 
			// a 'COMMIT_SUCCESS' confirmation from the Mobile Hub before marking delivered.
			db.MarkDelivered(database, msg.ID)

			log.Printf("Outbox [Delivered]: MsgID %d -> App: %v", msg.ID, "Mobile Hub")
		}
		
		time.Sleep(100 * time.Millisecond) // Yield briefly gracefully
	}
}
