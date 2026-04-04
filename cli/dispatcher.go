package main

import (
	"database/sql"
	"log"
	"net"
	"time"

	"verve-cli/db"
)

func sendTelemetry(conn net.Conn, database *sql.DB) {
	defer conn.Close()
	log.Printf("Successfully established stream with Mobile Hub at %s", conn.RemoteAddr())

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
