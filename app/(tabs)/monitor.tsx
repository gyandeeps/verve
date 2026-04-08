import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { SessionBlock, TelemetryData } from "@/db/DatabaseService";
import { discoveryService } from "@/services/DiscoveryService";
import {
  healthService,
  isPermissionFlowActive,
} from "@/services/health-service";
import { syncService } from "@/services/SyncService";
import { SessionDetailModal } from "@/src/components/session/SessionDetailModal";
import { SessionItem } from "@/src/components/session/SessionItem";
import { Text, View } from "@/src/components/Themed";
import {
  insightsService,
  SessionInsight,
} from "@/src/services/InsightsService";
import { formatDateTime } from "@/src/utils/format";
import { SymbolView } from "expo-symbols";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Platform,
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
  const [history, setHistory] = useState<SessionInsight[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionInsight | null>(
    null,
  );
  const [lastHealthSync, setLastHealthSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  /**
   * Identifies the "Dominant App" for a given 60-second telemetry window.
   * In our high-density session architecture, a single minute can contain multiple
   * application context switches. This method parses the sessions_data array to
   * find the application where the user spent the most absolute time (duration_sec),
   * providing a high-fidelity summary of focus for the dashboard.
   */
  const getDominantApp = (sessions?: SessionBlock[]) => {
    if (!sessions || sessions.length === 0) return "Unknown";
    return sessions.reduce((prev, current) =>
      prev.duration_sec > current.duration_sec ? prev : current,
    ).app;
  };

  // Power Management: Kill the TCP connection as soon as the app goes into the background.
  // EXCEPTION: On Android, the Health Connect permission dialog causes an Activity transition
  // that fires AppState → "background". We MUST NOT sever the connection during that flow,
  // otherwise the permission request crashes with UninitializedPropertyAccessException.
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        // Guard: Don't kill the connection if Health Connect's permission dialog is open.
        // The dialog itself is a separate Activity, causing our app to appear "backgrounded".
        if (Platform.OS === "android" && isPermissionFlowActive) {
          console.log(
            "Sync [Monitor]: App backgrounded during Health permission flow — skipping disconnect.",
          );
          return;
        }

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

  const refreshHistory = useCallback(async () => {
    try {
      const insights = await insightsService.getInsightsData(0, 5);
      setHistory(insights.sessions);
    } catch (e) {
      console.error("[Monitor] History refresh error:", e);
    }
  }, []);

  // Load last sync status and history from database on mount for display purposes only.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const lastSyncTs = await healthService.getLastSyncTimestamp();
        if (lastSyncTs && isMounted) {
          setLastHealthSync(formatDateTime(lastSyncTs));
        }
        if (isMounted) {
          await refreshHistory();
        }
      } catch (e) {
        console.error("[Monitor] Status load error:", e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [refreshHistory]);

  const startMonitoring = async () => {
    // REQUIRE Biometric Permissions before starting local discovery.
    // This provides a clear 'Proceed/Block' path to the user.
    console.log("[Monitor] Verifying Health Permissions before connect...");
    const isAuthorized = await healthService.authorize();

    if (!isAuthorized) {
      Alert.alert(
        "Health Access Required",
        "Verve needs access to your Heart Rate data to provide cognitive insights and biometric telemetry. Please grant permissions in the next prompt or in your system settings.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue with Sync",
            onPress: () => {
              // Retry authorization once before giving up
              healthService.authorize().then((authorized) => {
                if (authorized) {
                  proceedWithScanning();
                } else {
                  Alert.alert(
                    "Permission Denied",
                    "We cannot establish a cognitive data stream without Health access. Connection aborted.",
                  );
                }
              });
            },
          },
        ],
      );
      return;
    }

    proceedWithScanning();
  };

  const proceedWithScanning = () => {
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

          // 2. Refresh history with full insights (including IDs and any early samples)
          await refreshHistory();

          // 3. Trigger contextual health sync based on the batch window
          const timestamps = batch.map((t) => t.start_timestamp);
          await healthService.syncHealthData(timestamps);

          // Refresh display and history after contextual sync
          await refreshHistory();
          const lastSyncTs = await healthService.getLastSyncTimestamp();
          if (lastSyncTs) {
            setLastHealthSync(formatDateTime(lastSyncTs));
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

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const result = await healthService.syncHealthData();
      console.log(
        `[Monitor] Manual sync complete: ${result.storedCount}/${result.samplesCount} samples.`,
      );

      const lastSyncTs = await healthService.getLastSyncTimestamp();
      if (lastSyncTs) {
        setLastHealthSync(formatDateTime(lastSyncTs));
      }
    } catch (e) {
      Alert.alert("Sync Error", "Failed to catch-up on health data.");
    } finally {
      await refreshHistory();
      setIsSyncing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Monitor</Text>
          <Text style={styles.subtitle}>COGNITIVE CONTEXT STREAM</Text>
        </View>
        <View
          style={[
            styles.consoleStatusBadge,
            status !== "IDLE" && styles.consoleStatusBadgeActive,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              status === "CONNECTED"
                ? styles.dotGreen
                : status === "SCANNING"
                  ? styles.dotBlue
                  : styles.dotGray,
            ]}
          />
          <Text
            style={[
              styles.consoleStatusText,
              status !== "IDLE" && { color: Colors.text },
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

        <View style={styles.biometricBadge}>
          <View style={styles.biometricHeaderRow}>
            <View>
              <Text style={styles.biometricLabel}>HEALTH SYNC</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                <Text style={styles.biometricValue}>Last updated: </Text>
                <Text style={styles.technicalValue}>
                  {lastHealthSync || "Never"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleManualSync}
              disabled={isSyncing}
              style={styles.manualSyncButton}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={Colors.tertiary} />
              ) : (
                <SymbolView
                  name={{
                    ios: "arrow.triangle.2.circlepath",
                    android: "sync",
                    web: "refresh",
                  }}
                  size={18}
                  tintColor={Colors.tertiary}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {latestTelemetry ? (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>DOMINANT APP</Text>
                <Text style={styles.statValue} numberOfLines={1}>
                  {getDominantApp(latestTelemetry.sessions_data)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>CHURN RATE</Text>
                <Text style={styles.technicalStatValue}>
                  {(
                    (latestTelemetry.churn_rate || 0) /
                    ((latestTelemetry.end_timestamp -
                      latestTelemetry.start_timestamp) /
                      60000 || 2)
                  ).toFixed(1)}
                  /min
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>IDLE TIME</Text>
                <Text style={styles.technicalStatValue}>
                  {latestTelemetry.idle_timer}s
                </Text>
              </View>
            </View>

            <View style={styles.historyContainer}>
              <Text style={styles.sectionTitle}>Recent Sessions</Text>
              {history.map((item) => (
                <SessionItem
                  key={item.id}
                  item={item}
                  onPress={setSelectedSession}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWell}>
              <SymbolView
                name={
                  status === "SCANNING"
                    ? {
                        ios: "antenna.radiowaves.left.and.right",
                        android: "wifi_tethering",
                        web: "radar",
                      }
                    : { ios: "terminal.fill", android: "terminal", web: "code" }
                }
                size={24}
                tintColor={Colors.subText}
              />
            </View>
            <Text style={styles.emptyText}>
              {status === "SCANNING"
                ? "Locating authorized workstation..."
                : "Monitoring station is currently offline."}
            </Text>
            {status === "SCANNING" && (
              <ActivityIndicator
                size="small"
                color={Colors.primary}
                style={{ marginTop: 16 }}
              />
            )}
          </View>
        )}
      </ScrollView>

      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />

      <View style={styles.floatingContainer}>
        <TouchableOpacity
          style={[
            styles.bottomAction,
            status === "IDLE" ? styles.bgPrimary : styles.bgSecondary,
          ]}
          onPress={status === "IDLE" ? startMonitoring : stopMonitoring}
          activeOpacity={0.8}
        >
          <Text style={styles.bottomActionText}>
            {status === "IDLE"
              ? "INITIALIZE LOCAL MONITOR"
              : status === "SCANNING"
                ? "ABORT SCANNING"
                : "TERMINATE DATA STREAM"}
          </Text>
          <SymbolView
            name={
              status === "IDLE"
                ? { ios: "play.fill", android: "play_arrow", web: "play_arrow" }
                : { ios: "stop.fill", android: "stop", web: "stop" }
            }
            size={14}
            tintColor={Colors.background}
          />
        </TouchableOpacity>
      </View>
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
    alignItems: "flex-end",
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
    fontFamily: "InterExtraBold",
    letterSpacing: -1,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    letterSpacing: 1,
    marginTop: -2,
  },
  consoleStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface_container,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
    gap: 8,
  },
  consoleStatusBadgeActive: {
    borderColor: "rgba(173, 198, 255, 0.4)",
  },
  consoleStatusGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotGreen: {
    backgroundColor: Colors.tertiary,
  },
  dotBlue: {
    backgroundColor: Colors.primary,
  },
  dotGray: {
    backgroundColor: Colors.subText,
  },
  consoleStatusText: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    textTransform: "uppercase",
  },
  content: {
    paddingHorizontal: Layout.horizontalPadding,
    paddingBottom: 120, // More padding for floating button
    gap: 20,
  },
  card: {
    backgroundColor: Colors.surface_container,
    padding: 14,
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
    fontFamily: "SpaceGroteskBold",
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
    paddingVertical: 40,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surface_container_lowest,
    borderRadius: Layout.borderRadius,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
    borderStyle: "dashed",
  },
  emptyIconWell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface_container,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter",
    color: Colors.subText,
    lineHeight: 18,
    maxWidth: 200,
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
  biometricBadge: {
    backgroundColor: Colors.surface_container,
    padding: 14,
    borderRadius: Layout.borderRadius,
  },
  biometricHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  manualSyncButton: {
    width: 40,
    height: 40,
    borderRadius: Layout.borderRadius, // md rounded square
    backgroundColor: "rgba(78, 222, 163, 0.05)",
    justifyContent: "center",
    alignItems: "center",
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
  technicalValue: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk",
    color: Colors.tertiary,
  },
  technicalStatValue: {
    fontSize: 18,
    fontFamily: "SpaceGroteskBold",
    color: Colors.text,
  },
  floatingContainer: {
    position: "absolute",
    bottom: 12,
    left: 20,
    right: 20,
    backgroundColor: "transparent",
  },
  bottomAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 12,
    shadowColor: Colors.on_surface,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 32,
    elevation: 10,
  },
  bgPrimary: {
    backgroundColor: Colors.primary,
  },
  bgSecondary: {
    backgroundColor: Colors.secondary,
  },
  bottomActionText: {
    fontSize: 12,
    fontFamily: "SpaceGroteskBold",
    color: Colors.background,
    letterSpacing: 1,
  },
});
