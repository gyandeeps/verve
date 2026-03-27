import { Text, View } from "@/components/Themed";
import { TelemetryData } from "@/db/DatabaseService";
import { discoveryService } from "@/services/DiscoveryService";
import { syncService } from "@/services/SyncService";
import React, { useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";

export default function TabOneScreen() {
  const [status, setStatus] = useState<"IDLE" | "SCANNING" | "CONNECTED">(
    "IDLE",
  );
  const [workstation, setWorkstation] = useState<string | null>(null);
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryData | null>(
    null,
  );
  const [history, setHistory] = useState<TelemetryData[]>([]);

  const startMonitoring = () => {
    setStatus("SCANNING");
    discoveryService.startScanning((device) => {
      setStatus("CONNECTED");
      setWorkstation(device.name);

      const ip = device.addresses[0];
      const port = device.port || 8088;

      syncService.startServer(
        (data) => {
          try {
            const telemetry: TelemetryData = JSON.parse(data);
            setLatestTelemetry(telemetry);
            setHistory((prev) => [telemetry, ...prev].slice(0, 5));
          } catch (e) {}
        },
        () => {
          setStatus("IDLE");
          setWorkstation(null);
        },
      );

      // Handshake: Ping the CLI to start sending telemetry
      fetch(`http://${ip}:${port}/connect`)
        .then(() => console.log("Sync [Handshake]: Workstation notified."))
        .catch((err) =>
          console.warn("Sync [Handshake Error]: Failed to reach CLI:", err),
        );
    });
  };

  const stopMonitoring = () => {
    discoveryService.stopScanning();
    syncService.stopServer();
    setStatus("IDLE");
    setWorkstation(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cognitive Status</Text>
        <View
          style={[
            styles.statusBadge,
            status === "CONNECTED" ? styles.statusGreen : styles.statusGray,
          ]}
        >
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {status === "CONNECTED" && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SOURCE</Text>
            <Text style={styles.cardValue}>{workstation}</Text>
          </View>
        )}

        {latestTelemetry ? (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>ACTIVE APP</Text>
                <Text style={styles.statValue} numberOfLines={1}>
                  {latestTelemetry.active_app}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>CHURN RATE</Text>
                <Text style={styles.statValue}>
                  {latestTelemetry.churn_rate.toFixed(1)}/min
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>IDLE TIME</Text>
                <Text style={styles.statValue}>
                  {latestTelemetry.idle_timer}s
                </Text>
              </View>
            </View>

            <View style={styles.historyContainer}>
              <Text style={styles.sectionTitle}>Recent Context</Text>
              {history.map((item, index) => (
                <View key={item.timestamp + index} style={styles.historyItem}>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyApp}>{item.active_app}</Text>
                    <Text style={styles.historyTitle} numberOfLines={1}>
                      {item.window_title}
                    </Text>
                  </View>
                  <Text style={styles.historyTime}>
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {status === "SCANNING"
                ? "Searching for workstation..."
                : "Tap below to start monitoring context."}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            status === "IDLE" ? styles.buttonPrimary : styles.buttonDanger,
          ]}
          onPress={status === "IDLE" ? startMonitoring : stopMonitoring}
        >
          <Text style={styles.buttonText}>
            {status === "IDLE" ? "Start Local Monitor" : "Stop Tracking"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
  },
  header: {
    paddingHorizontal: 25,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusGreen: {
    backgroundColor: "#34C75922",
    borderWidth: 1,
    borderColor: "#34C759",
  },
  statusGray: {
    backgroundColor: "#8E8E9322",
    borderWidth: 1,
    borderColor: "#8E8E93",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#34C759",
  },
  content: {
    paddingHorizontal: 25,
  },
  card: {
    backgroundColor: "#00000010",
    padding: 10,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ffffff10",
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "700",
    opacity: 0.5,
    marginBottom: 5,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statCard: {
    width: "48%",
    backgroundColor: "#00000010",
    padding: 10,
    borderRadius: 18,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#ffffff10",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    opacity: 0.5,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyState: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.5,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 16,
  },
  button: {
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  buttonPrimary: {
    backgroundColor: "#007AFF",
  },
  buttonDanger: {
    backgroundColor: "#FF3B30",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  historyContainer: {
    marginTop: 10,
    gap: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    opacity: 0.6,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 8,
    borderRadius: 15,
    borderWidth: 4,
    borderColor: "#0a010105",
  },
  historyInfo: {
    flex: 1,
    marginRight: 10,
  },
  historyApp: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  historyTitle: {
    fontSize: 12,
    opacity: 0.5,
  },
  historyTime: {
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.4,
    fontFamily: "Courier",
  },
});
