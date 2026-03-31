import { Text, View } from "@/components/Themed";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { TelemetryData } from "@/db/DatabaseService";
import { discoveryService } from "@/services/DiscoveryService";
import { syncService } from "@/services/SyncService";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { AppState, AppStateStatus } from "react-native";
import { healthService } from "@/services/HealthService";
import { databaseService } from "@/db/DatabaseService";
import { useEffect } from "react";

export default function MonitorScreen() {
  const [status, setStatus] = useState<"IDLE" | "SCANNING" | "CONNECTED">(
    "IDLE",
  );
  const [workstation, setWorkstation] = useState<string | null>(null);
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryData | null>(
    null,
  );
  const [history, setHistory] = useState<TelemetryData[]>([]);
  const [lastHealthSync, setLastHealthSync] = useState<string | null>(null);

  // Health Sync Logic (Sync Anchor Pattern)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        console.log("Sync [Health]: App returned to foreground. Polling...");
        await healthService.syncHealthData();
        const lastSync = await databaseService.getMetadata(
          "last_health_sync_timestamp",
        );
        if (lastSync)
          setLastHealthSync(
            new Date(parseInt(lastSync, 10)).toLocaleTimeString(),
          );
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    // Initial sync on mount
    healthService.syncHealthData().then(async () => {
      const lastSync = await databaseService.getMetadata(
        "last_health_sync_timestamp",
      );
      if (lastSync)
        setLastHealthSync(
          new Date(parseInt(lastSync, 10)).toLocaleTimeString(),
        );
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const startMonitoring = () => {
    setStatus("SCANNING");
    discoveryService.startScanning((device) => {
      setStatus("CONNECTED");
      setWorkstation(device.name);

      const ip = device.addresses[0];
      const port = device.port || 8088;

      syncService.startServer(
        (batch, range) => {
          // 1. Update UI with latest record (last in chronological batch)
          const latest = batch[batch.length - 1];
          setLatestTelemetry(latest);

          // 2. Add all records from batch to history (latest first)
          const reversedBatch = [...batch].reverse();
          setHistory((prev) => [...reversedBatch, ...prev].slice(0, 10));

          // 3. Trigger contextual health sync based on the batch window (5s buffer applied in service)
          // Pass the specific batch timestamps to filter out health data points that don't align with context.
          const timestamps = batch.map((t) => t.timestamp);
          healthService.syncHealthData(range.minTs, range.maxTs, timestamps);
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

        {__DEV__ && (
          <Link href="/dev-settings" asChild>
            <Pressable style={styles.infoButton}>
              {({ pressed }) => (
                <SymbolView
                  name={{
                    ios: "info.circle",
                    android: "info",
                    web: "info",
                  }}
                  size={24}
                  tintColor={Colors.text}
                  style={{ opacity: pressed ? 0.5 : 1 }}
                />
              )}
            </Pressable>
          </Link>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {status === "CONNECTED" && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SOURCE</Text>
            <Text style={styles.cardValue}>{workstation}</Text>
          </View>
        )}

        <View style={styles.biometricBadge}>
          <Text style={styles.biometricLabel}>HEALTH SYNC</Text>
          <Text style={styles.biometricValue}>
            {lastHealthSync
              ? `Last updated: ${lastHealthSync}`
              : "Waiting for permissions..."}
          </Text>
        </View>

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
    borderRadius: Layout.borderRadius, // sm/md corners
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
    backgroundColor: "transparent",
    borderColor: Colors.surface_container,
    borderWidth: 1.5,
  },
  statusText: {
    fontSize: 11, // label-sm
    fontFamily: "SpaceGroteskBold",
    letterSpacing: 0.5,
  },
  infoButton: {
    marginLeft: 12,
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.surface_container,
    padding: 20,
    borderRadius: Layout.borderRadius,
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
    borderRadius: Layout.borderRadius,
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
    backgroundColor: Colors.surface_container,
    borderRadius: Layout.borderRadius,
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
    borderRadius: Layout.borderRadius,
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
    borderRadius: Layout.borderRadius,
    backgroundColor: Colors.surface_container,
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
  biometricBadge: {
    backgroundColor: Colors.surface_container,
    padding: 16,
    borderRadius: Layout.borderRadius,
    marginBottom: 28,
  },
  biometricLabel: {
    fontSize: 11,
    fontFamily: "SpaceGroteskBold",
    color: Colors.tertiary,
    marginBottom: 4,
    letterSpacing: 1,
  },
  biometricValue: {
    fontSize: 12,
    fontFamily: "Inter",
    color: Colors.subText,
  },
});
