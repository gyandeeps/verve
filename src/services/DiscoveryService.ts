import Zeroconf from "react-native-zeroconf";

class DiscoveryService {
  private zeroconf = new Zeroconf();

  constructor() {
    this.zeroconf.on("start", () => console.log("The scan has started."));
    this.zeroconf.on("stop", () => console.log("The scan has stopped."));
    this.zeroconf.on("error", (err) => console.error("Zeroconf Error:", err));
  }

  startScanning(onDeviceFound: (device: any) => void) {
    // Clean up previous listeners to prevent multiple callbacks
    this.zeroconf.removeAllListeners("resolved");
    
    // Look for the specific service type defined in the Go CLI
    this.zeroconf.scan("cognistaff", "tcp", "local.");

    this.zeroconf.on("resolved", (service) => {
      console.log("Found Workstation:", service);
      // service.addresses[0] will contain the local IP
      onDeviceFound(service);
    });
  }

  stopScanning() {
    this.zeroconf.stop();
  }
}

export const discoveryService = new DiscoveryService();
