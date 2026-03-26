import { discoveryService } from "@/src/services/DiscoveryService";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { syncService } from "../../src/services/SyncService";

export default function ConnectionScreen() {
  const [status, setStatus] = useState<
    "Disconnected" | "Searching" | "Connected"
  >("Disconnected");
  const [workstationIP, setWorkstationIP] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<Array<string>>([]);

  const handleConnect = () => {
    setStatus("Searching");
    discoveryService.startScanning((device) => {
      if (device.addresses && device.addresses.length > 0) {
        const ip = device.addresses[0];
        const port = device.port || 8088;
        setWorkstationIP(ip);
        setStatus("Connected");
        discoveryService.stopScanning();

        // Start listening for telemetry FIRST so the Go server can connect
        syncService.startServer(
          (data) => {
            console.log("Received data:", data);
            setTelemetry((prev) => [...prev, data]);
          },
          () => {
            console.log("CLI connection lost");
            setStatus("Disconnected");
            setWorkstationIP(null);
          },
        );

        // Notify the UI/workstation that we connected
        fetch(`http://${ip}:${port}/connect`)
          .then(() => {
            console.log("Connected to workstation");
          })
          .catch((err) => {
            console.log("Failed to ping workstation:", err);
          });
      }
    });
  };

  const handleDisconnect = () => {
    syncService.stopServer();
    setStatus("Disconnected");
    setWorkstationIP(null);
    setTelemetry([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CogniStaff Hub</Text>
      <View
        style={[
          styles.indicator,
          { backgroundColor: status === "Connected" ? "#4ADE80" : "#F87171" },
        ]}
      />
      <Text style={styles.statusText}>Status: {status}</Text>
      {workstationIP && <Text>Workstation IP: {workstationIP}</Text>}

      {status === "Connected" ? (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#F87171" }]}
          onPress={handleDisconnect}
        >
          <Text style={styles.buttonText}>Disconnect</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.button,
            status === "Searching" && { backgroundColor: "#A0A0A0" },
          ]}
          onPress={handleConnect}
          disabled={status === "Searching"}
        >
          <Text style={styles.buttonText}>
            {status === "Searching" ? "Searching..." : "Scan for Workstation"}
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView
        style={{ marginTop: 20, width: "100%", paddingHorizontal: 20, flex: 1 }}
      >
        <Text style={{ fontWeight: "bold", marginBottom: 10 }}>Telemetry:</Text>
        {telemetry.map((item, index) => (
          <Text key={index} style={{ marginBottom: 5 }}>
            {item}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  indicator: { width: 20, height: 20, borderRadius: 10, marginBottom: 10 },
  statusText: { fontSize: 18, marginBottom: 20 },
  button: { backgroundColor: "#007AFF", padding: 15, borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
