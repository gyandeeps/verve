import { Text, View } from "@/components/Themed";
import { TelemetryData } from "@/db/DatabaseService";
import { discoveryService } from "@/services/DiscoveryService";
import { syncService } from "@/services/SyncService";
import React, { useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import Colors from "@/constants/Colors";

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
            status === "CONNECTED"
              ? styles.statusGreen
              : status === "SCANNING"
              ? styles.statusScanning
              : styles.statusGray,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              status === "CONNECTED"
                ? { color: Colors.tertiary }
                : status === "SCANNING"
                ? { color: Colors.primary }
                : { color: Colors.subText },
            ]}
          >
            {status}
          </Text>
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
    paddingTop: 30,
    backgroundColor: Colors.surface,
  },
  header: {
    paddingLeft: 30,
    paddingRight: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 32, // Display-LG concept adapted for mobile header
    fontFamily: "InterExtraBold",
    letterSpacing: -1,
    color: Colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6, // sm/md corners
    borderWidth: 1,
  },
  statusGreen: {
    backgroundColor: "rgba(78, 222, 163, 0.15)", // tertiary alpha
    borderColor: Colors.tertiary,
  },
  statusScanning: {
    backgroundColor: "rgba(173, 198, 255, 0.15)", // primary alpha
    borderColor: Colors.primary,
  },
  statusGray: {
    backgroundColor: Colors.surface_container_lowest,
    borderColor: Colors.outline_variant,
  },
  statusText: {
    fontSize: 11, // label-sm
    fontFamily: "SpaceGroteskBold",
    letterSpacing: 0.5,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.surface_container,
    padding: 20,
    borderRadius: 6,
    marginBottom: 28, // Spacing 8 -> 1.75rem ~ 28px
  },
  cardLabel: {
    fontSize: 11,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  cardValue: {
    fontSize: 20,
    fontFamily: "InterSemi",
    color: Colors.text,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  statCard: {
    width: "48%",
    backgroundColor: Colors.surface_container,
    padding: 16,
    borderRadius: 6,
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontFamily: "InterBold",
    color: Colors.text,
  },
  emptyState: {
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surface_container_lowest,
    borderRadius: 6,
    marginTop: 20,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Inter",
    color: Colors.subText,
  },
  button: {
    height: 50,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  buttonPrimary: {
    backgroundColor: Colors.primary_container,
  },
  buttonDanger: {
    backgroundColor: Colors.secondary_container,
  },
  buttonText: {
    color: Colors.on_primary,
    fontSize: 14,
    fontFamily: "InterBold",
    letterSpacing: 0.5,
  },
  historyContainer: {
    marginTop: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 6,
    backgroundColor: Colors.surface_container_lowest,
    borderWidth: 1,
    borderColor: Colors.outline_variant, // Ghost border
    marginBottom: 8,
  },
  historyInfo: {
    flex: 1,
    marginRight: 10,
  },
  historyApp: {
    fontSize: 14,
    fontFamily: "InterBold",
    color: Colors.text,
    marginBottom: 4,
  },
  historyTitle: {
    fontSize: 12,
    fontFamily: "Inter",
    color: Colors.subText,
  },
  historyTime: {
    fontSize: 11,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
  },
});
