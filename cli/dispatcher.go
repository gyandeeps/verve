package main

import (
	"bufio"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"net"
	"strings"
	"time"

	"verve-cli/db"
)

func sendTelemetry(conn net.Conn, database *sql.DB) {
	defer conn.Close()

	// Enable TCP Keep-Alives
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpConn.SetKeepAlive(true)
		tcpConn.SetKeepAlivePeriod(10 * time.Second)
	}

	// 1. Authentication Handshake
	// The app must send "AUTH <pairing_code|session_token> <deviceName>"
	reader := bufio.NewReader(conn)
	authLine, err := reader.ReadString('\n')
	if err != nil {
		log.Printf("Handshake failed: could not read auth line: %v", err)
		return
	}

	parts := strings.Fields(strings.TrimSpace(authLine))
	if len(parts) < 2 || parts[0] != "AUTH" {
		conn.Write([]byte("AUTH_FAILED invalid_format\n"))
		log.Printf("Handshake failed: invalid format from %s", conn.RemoteAddr())
		return
	}

	secret := parts[1]
	deviceName := "Unknown"
	if len(parts) > 2 {
		deviceName = strings.Join(parts[2:], " ")
	}

	pairingCode, _ := db.GetConfig(database, "pairing_code")
	isValidToken, _ := db.ValidateAuthToken(database, secret)

	var sessionToken string
	if secret == pairingCode {
		// Pairing successful, generate a session token
		tokenBytes := make([]byte, 16)
		_, _ = rand.Read(tokenBytes)
		sessionToken = hex.EncodeToString(tokenBytes)
		db.AddAuthToken(database, sessionToken, deviceName)

		conn.Write([]byte(fmt.Sprintf("AUTH_OK %s\n", sessionToken)))
		log.Printf("Successfully PAIRED with %s (%s)", deviceName, conn.RemoteAddr())
	} else if isValidToken {
		// Session token valid
		conn.Write([]byte("AUTH_OK\n"))
		log.Printf("Successfully AUTHENTICATED %s (%s)", deviceName, conn.RemoteAddr())
	} else {
		conn.Write([]byte("AUTH_FAILED invalid_secret\n"))
		log.Printf("Authentication failed for %s", conn.RemoteAddr())
		return
	}

	// 2. Start telemetry stream
	// Create a channel to signal disconnection detected by the background reader
	disconnectChan := make(chan struct{})
	go func() {
		// Continue reading from the connection to detect EOF/Disconnect
		for {
			_, err := reader.ReadByte()
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
			return
		case <-disconnectChan:
			log.Println("Mobile App disconnected. Halting outbox dispatcher.")
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
				_, err = conn.Write([]byte(msg.Payload + "\n"))
				if err != nil {
					log.Println("Mobile App disconnected (write error). Halting outbox dispatcher.")
					return
				}

				db.MarkDelivered(database, msg.ID)
				log.Printf("Outbox [Delivered]: MsgID %d -> %s", msg.ID, deviceName)
			}

			select {
			case <-shutdownChan:
				return
			case <-disconnectChan:
				log.Println("Mobile App disconnected (detected by read during throttle). Halting outbox dispatcher.")
				return
			case <-time.After(100 * time.Millisecond):
			}
		}
	}
}
