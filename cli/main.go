package main

import (
	"crypto/rand"
	"flag"
	"fmt"
	"log"
	"math/big"
	"net"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"verve-cli/db"
	"verve-cli/netutil"

	"github.com/grandcat/zeroconf"
)

const (
	DEFAULT_POLLING_INTERVAL = 10
	REPORTING_WINDOW_SECONDS = 120
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
	intervalFlag := flag.Int("interval", DEFAULT_POLLING_INTERVAL, "Polling interval in seconds")
	showPairingFlag := flag.Bool("show-pairing-code", false, "Print the active pairing code and exit")
	flag.Parse()

	if *versionFlag {
		fmt.Println("verve-cli", Version)
		os.Exit(0)
	}

	database, err := db.InitDB(DB_NAME)
	if err != nil {
		log.Fatalf("Failed to initialize SQLite database: %v", err)
	}

	if *showPairingFlag {
		pairingCode, err := db.GetConfig(database, "pairing_code")
		if err != nil {
			log.Fatalf("Error fetching pairing code: %v", err)
		}
		if pairingCode == "" {
			fmt.Println("No pairing code found. Run the CLI normally to generate one.")
		} else {
			fmt.Println("Pairing Code: ", pairingCode)
		}
		os.Exit(0)
	}

	// Print database health stats to console
	db.PrintDBSummary(database)

	// Ensure we have a pairing code
	pairingCode, err := db.GetConfig(database, "pairing_code")
	if err != nil {
		log.Printf("Error fetching pairing code: %v", err)
	}
	if pairingCode == "" {
		// Generate 6-digit code
		n, _ := rand.Int(rand.Reader, big.NewInt(900000))
		pairingCode = fmt.Sprintf("%06d", n.Int64()+100000)
		db.SetConfig(database, "pairing_code", pairingCode)
		log.Printf("NEW PAIRING CODE GENERATED: %s", pairingCode)
	} else {
		log.Printf("ACTIVE PAIRING CODE: %s", pairingCode)
	}

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

	// Identify interfaces for reference
	libIfaces := netutil.ListMulticastInterfaces()
	discoveryIfaces := netutil.GetDiscoveryInterfaces()

	// Log comparison for reference
	var libNames, physicalNames []string
	for _, iface := range libIfaces {
		libNames = append(libNames, iface.Name)
	}
	for _, iface := range discoveryIfaces {
		physicalNames = append(physicalNames, iface.Name)
	}

	log.Printf("Discovery: Library would choose: [%s]", strings.Join(libNames, ", "))
	log.Printf("Discovery: Verve physical filter: [%s]", strings.Join(physicalNames, ", "))

	if len(discoveryIfaces) > 0 {
		var names []string
		for _, iface := range discoveryIfaces {
			names = append(names, iface.Name)
		}
		log.Printf("Discovery: Binding mDNS to physical interfaces: %s", strings.Join(names, ", "))
	} else {
		log.Println("Discovery: No specific physical interfaces found, falling back to all.")
	}

	// Register the Verve service
	server, err := zeroconf.Register(dynamicServiceName, SERVICE_TYPE, "local.", SERVICE_PORT, []string{"txtv=0", "lo=1"}, discoveryIfaces)
	if err != nil {
		log.Fatalf("Failed to register mDNS service: %v", err)
	}

	log.Println("Shadow CLI: mDNS service registered as", dynamicServiceName, "on port", SERVICE_PORT)
	log.Println("Press Ctrl+C to stop...")

	// Start a TCP server to listen for actual connections from the app
	listener, err := net.Listen("tcp", ":"+strconv.Itoa(SERVICE_PORT))
	if err != nil {
		log.Fatalf("Failed to start TCP server on port %d: %v", SERVICE_PORT, err)
	}

	go func() {
		defer listener.Close()
		for {
			conn, err := listener.Accept()
			if err != nil {
				select {
				case <-shutdownChan:
					return
				default:
					log.Printf("Failed to accept connection: %v", err)
				}
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

	if listener != nil {
		listener.Close()
	}

	// Wait for cleanup with a timeout
	done := make(chan struct{})
	go func() {
		if server != nil {
			server.Shutdown()
		}
		if database != nil {
			database.Close()
		}
		close(done)
	}()

	select {
	case <-done:
		log.Println("Graceful shutdown complete.")
	case <-time.After(5 * time.Second):
		log.Println("Shutdown timed out, forcing exit.")
	}
	os.Exit(0)
}
