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

	// Enable TCP Keep-Alives to detect network-level partitions
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpConn.SetKeepAlive(true)
		tcpConn.SetKeepAlivePeriod(10 * time.Second)
	}

	// Create a channel to signal disconnection detected by the background reader
	disconnectChan := make(chan struct{})
	go func() {
		// Attempt to read from the connection. Since the app is only a consumer,
		// any read result (error or unexpected data) indicates we should check the connection.
		// EOF is the standard way TCP signals a clean disconnection.
		buf := make([]byte, 1)
		for {
			_, err := conn.Read(buf)
			if err != nil {
				close(disconnectChan)
				return
			}
		}
	}()

	for {
		select {
		case <-shutdownChan:
			log.Println("Graceful Shutdown: Closing stream connection.")
			return // Exiting triggers deferred conn.Close()
		case <-disconnectChan:
			log.Println("Mobile App disconnected (detected by read). Halting outbox dispatcher.")
			return
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
				case <-disconnectChan:
					log.Println("Mobile App disconnected (detected by read during idle). Halting outbox dispatcher.")
					return
				case <-time.After(1 * time.Second):
					continue
				}
			}

			for _, msg := range msgs {
				// Write the payload with a newline delimiter to assist JSON stream parsing
				_, err = conn.Write([]byte(msg.Payload + "\n"))
				if err != nil {
					log.Println("Mobile App disconnected (detected by write error). Halting outbox dispatcher.")
					return
				}

				db.MarkDelivered(database, msg.ID)
				log.Printf("Outbox [Delivered]: MsgID %d -> App: %v", msg.ID, "Mobile Hub")
			}

			// Wait a bit before next batch, but allow interrupt
			select {
			case <-shutdownChan:
				return
			case <-disconnectChan:
				log.Println("Mobile App disconnected (detected by read during throttle). Halting outbox dispatcher.")
				return
			case <-time.After(100 * time.Millisecond):
				// continue
			}
		}
	}
}
