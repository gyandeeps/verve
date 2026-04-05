import Zeroconf from "react-native-zeroconf";

class DiscoveryService {
  private zeroconf: Zeroconf | null = null;

  constructor() {
    // We defer initialization to startScanning to avoid native crashes on module load
  }

  private getZeroconf(): Zeroconf {
    if (!this.zeroconf) {
      this.zeroconf = new Zeroconf();
      this.zeroconf.on("start", () => console.log("The scan has started."));
      this.zeroconf.on("stop", () => console.log("The scan has stopped."));
      this.zeroconf.on("error", (err) => console.error("Zeroconf Error:", err));
    }
    return this.zeroconf;
  }

  startScanning(onDeviceFound: (device: any) => void) {
    const zc = this.getZeroconf();
    // Clean up previous listeners to prevent multiple callbacks
    zc.removeAllListeners("resolved");

    // Look for the specific service type defined in the Go CLI
    zc.scan("verve", "tcp", "local.");

    zc.on("resolved", (service) => {
      console.log("Found Workstation:", service);
      // service.addresses[0] will contain the local IP
      onDeviceFound(service);
    });
  }

  stopScanning() {
    this.zeroconf?.stop();
  }
}

export const discoveryService = new DiscoveryService();
