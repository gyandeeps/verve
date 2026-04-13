package netutil

import (
	"log"
	"net"
	"strings"
)

// GetDiscoveryInterfaces returns a list of physical network interfaces,
// excluding virtual ones like VPN tunnels (utun), Netskope adapters,
// or virtualization bridges (docker/vbox) to ensure mDNS discovery
// works correctly on local networks even when a VPN or security client is active.
func GetDiscoveryInterfaces() []net.Interface {
	ifaces, err := net.Interfaces()
	if err != nil {
		log.Printf("Discovery: Error fetching network interfaces: %v", err)
		return nil
	}

	var physicalIfaces []net.Interface
	for _, iface := range ifaces {
		// Skip loopback and down interfaces
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}

		name := strings.ToLower(iface.Name)

		// Common Virtual/VPN/Tunnel interface indicators
		// - 'utun', 'gif', 'stf' (macOS)
		// - 'tun', 'tap' (Generic VPN)
		// - 'nps', 'netskope' (Netskope)
		// - 'vnet', 'vbox', 'docker', 'vmnet' (Virtualization)
		isVirtual := strings.HasPrefix(name, "utun") ||
			strings.HasPrefix(name, "tun") ||
			strings.HasPrefix(name, "tap") ||
			strings.HasPrefix(name, "gif") ||
			strings.HasPrefix(name, "stf") ||
			strings.Contains(name, "vnet") ||
			strings.Contains(name, "vbox") ||
			strings.Contains(name, "docker") ||
			strings.Contains(name, "vmnet") ||
			strings.Contains(name, "netskope") ||
			strings.Contains(name, "nps")

		if isVirtual {
			continue
		}

		// Ensure the interface has at least one unicast IP address
		addrs, err := iface.Addrs()
		if err != nil || len(addrs) == 0 {
			continue
		}

		// Filter out local-only addresses if they are the only ones
		hasValidIP := false
		for _, addr := range addrs {
			ipnet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			// Skip IPv6 link-local as the primary indicator (though it's allowed)
			// and skip loopback IPs.
			if !ipnet.IP.IsLoopback() {
				hasValidIP = true
				break
			}
		}

		if hasValidIP {
			physicalIfaces = append(physicalIfaces, iface)
		}
	}

	return physicalIfaces
}

// ListMulticastInterfaces mimics the unexported listMulticastInterfaces
// function from the grandcat/zeroconf library. It returns all interfaces
// that are UP and support Multicast.
func ListMulticastInterfaces() []net.Interface {
	var interfaces []net.Interface
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	for _, ifi := range ifaces {
		if (ifi.Flags & net.FlagUp) == 0 {
			continue
		}
		if (ifi.Flags & net.FlagMulticast) > 0 {
			interfaces = append(interfaces, ifi)
		}
	}
	return interfaces
}
