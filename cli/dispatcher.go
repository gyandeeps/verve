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
		select {
		case <-shutdownChan:
			log.Println("Graceful Shutdown: Closing stream connection.")
			return // Exiting triggers deferred conn.Close()
		default:
			msgs, err := db.GetPendingMessages(database, 10)
			if err != nil {
				log.Printf("Failed to fetch pending outbox rows: %v", err)
				time.Sleep(2 * time.Second)
				continue
			}

			if len(msgs) == 0 {
				select {
				case <-shutdownChan:
					return
				case <-time.After(1 * time.Second):
					continue
				}
			}

			for _, msg := range msgs {
				// Write the payload with a newline delimiter to assist JSON stream parsing
				_, err = conn.Write([]byte(msg.Payload + "\n"))
				if err != nil {
					log.Println("Mobile App disconnected. Halting outbox dispatcher.")
					return
				}

				db.MarkDelivered(database, msg.ID)
				log.Printf("Outbox [Delivered]: MsgID %d -> App: %v", msg.ID, "Mobile Hub")
			}

			// Wait a bit before next batch, but allow interrupt
			select {
			case <-shutdownChan:
				return
			case <-time.After(100 * time.Millisecond):
				// continue
			}
		}
	}
}
