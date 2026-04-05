import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { databaseService, TelemetryData } from "@/db/DatabaseService";
import { discoveryService } from "@/services/DiscoveryService";
import { healthService } from "@/services/health-service";
import { syncService } from "@/services/SyncService";
import { Text, View } from "@/src/components/Themed";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useEffect, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

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

  // Power Management: Kill the TCP connection as soon as the app goes into the background.
  // This prevents the system from hanging or dropping the connection in an unstable way.
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        console.log(
          "Sync [Monitor]: App backgrounded. Severing TCP connection...",
        );
        stopMonitoring();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // Load last sync status from database on mount for display purposes only.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const lastSync = await databaseService.getMetadata(
          "last_health_sync_timestamp",
        );
        if (lastSync && isMounted) {
          const ts = parseInt(lastSync, 10);
          if (!isNaN(ts)) {
            setLastHealthSync(new Date(ts).toLocaleTimeString());
          }
        }
      } catch (e) {
        console.error("[Monitor] Status load error:", e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const startMonitoring = () => {
    setStatus("SCANNING");
    discoveryService.startScanning((device) => {
      const ip = device.addresses?.[0];
      if (!ip) {
        console.warn(
          "Sync [Discovery]: Device found but no IP address available.",
        );
        return;
      }

      setStatus("CONNECTED");
      setWorkstation(device.name);

      const port = device.port || 8088;

      syncService.connectToWorkstation(
        ip,
        port,
        async (batch, range) => {
          // 1. Update UI with latest record (last in chronological batch)
          const latest = batch[batch.length - 1];
          if (latest) setLatestTelemetry(latest);

          // 2. Add all records from batch to history (latest first)
          const reversedBatch = [...batch].reverse();
          setHistory((prev) => [...reversedBatch, ...prev].slice(0, 10));

          // 3. Trigger contextual health sync based on the batch window
          const timestamps = batch.map((t) => t.timestamp);
          if (
            range.minTs &&
            range.maxTs &&
            Number.isFinite(range.minTs) &&
            Number.isFinite(range.maxTs)
          ) {
            await healthService.syncHealthData(
              range.minTs,
              range.maxTs,
              timestamps,
            );

            // Refresh display of last sync status after contextual sync
            const lastSync = await databaseService.getMetadata(
              "last_health_sync_timestamp",
            );
            if (lastSync) {
              const ts = parseInt(lastSync, 10);
              if (!isNaN(ts))
                setLastHealthSync(new Date(ts).toLocaleTimeString());
            }
          }
        },
        () => {
          console.log("Sync [Monitor]: Connection lost or closed by peer.");
          setStatus("IDLE");
          setWorkstation(null);
        },
      );
    });
  };

  const stopMonitoring = () => {
    discoveryService.stopScanning();
    syncService.disconnect();
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

        <Link href="/dev-settings" asChild>
          <Pressable style={styles.infoButton}>
            {({ pressed }) => (
              <SymbolView
                name={Platform.OS === "ios" ? "info.circle" : "info"}
                size={24}
                tintColor={Colors.text}
                style={{ opacity: pressed ? 0.5 : 1 }}
              />
            )}
          </Pressable>
        </Link>
      </View>
      <View style={{ paddingHorizontal: Layout.horizontalPadding }}>
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
              : "No sync status available"}
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
                  {(latestTelemetry.churn_rate || 0).toFixed(1)}/min
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
                    {new Date(item.timestamp).toLocaleTimeString(undefined, {
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    gap: 20,
  },
  header: {
    paddingHorizontal: Layout.horizontalPadding,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    paddingLeft: 4,
  },
  content: {
    paddingHorizontal: Layout.horizontalPadding,
    paddingBottom: 40,
    gap: 20,
  },
  card: {
    backgroundColor: Colors.surface_container,
    padding: 20,
    borderRadius: Layout.borderRadius,
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
