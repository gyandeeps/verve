import { GradientButton } from "@/components/common/GradientButton";
import { WorkstationDiscoveryModal } from "@/components/monitor/WorkstationDiscoveryModal";
import { SessionDetailModal } from "@/components/session/SessionDetailModal";
import { SessionItem } from "@/components/session/SessionItem";
import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import {
  databaseService,
  SessionBlock,
  TelemetryData,
} from "@/db/DatabaseService";
import { discoveryService } from "@/services/DiscoveryService";
import {
  healthService,
  isPermissionFlowActive,
} from "@/services/health-service";
import { insightsService, SessionInsight } from "@/services/InsightsService";
import { syncService } from "@/services/SyncService";
import { formatDateTime } from "@/utils/format";
import Constants from "expo-constants";
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
  const [discoveryVisible, setDiscoveryVisible] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);

  // Persistent Auth State
  const [pairedDeviceName, setPairedDeviceName] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Connection UI State
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Load persistence on mount
  useEffect(() => {
    (async () => {
      const savedName = await databaseService.getMetadata(
        "paired_workstation_name",
      );
      const savedToken = await databaseService.getMetadata(
        "workstation_session_token",
      );
      if (savedName) setPairedDeviceName(savedName);
      if (savedToken) setSessionToken(savedToken);
    })();
  }, []);

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
      const insights = await insightsService.getInsightsData(5);
      setHistory(insights.sessions.slice(0, 5));
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
    console.log("[Monitor] Verifying Health Permissions before connect...");
    const isAuthorized = await healthService.authorize();

    if (!isAuthorized) {
      Alert.alert(
        "Health Access Required",
        "Verve needs access to your Heart Rate data to provide cognitive insights and biometric telemetry.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue with Sync",
            onPress: () => {
              healthService.authorize().then((authorized) => {
                if (authorized) {
                  startMonitoring();
                }
              });
            },
          },
        ],
      );
      return;
    }

    if (pairedDeviceName && sessionToken) {
      // We have a saved workstation, try to find it and connect automatically
      autoConnectToPairedWorkstation();
    } else {
      // First time: Open discovery
      setDiscoveryVisible(true);
      proceedWithScanning();
    }
  };

  const autoConnectToPairedWorkstation = () => {
    setStatus("SCANNING");
    let found = false;
    discoveryService.startScanning((device) => {
      if (device.name === pairedDeviceName && !found) {
        found = true;
        discoveryService.stopScanning();
        handleSelectDevice(device, sessionToken!);
      }
    });

    // Timeout if not found in 10s
    setTimeout(() => {
      if (!found && status === "SCANNING") {
        discoveryService.stopScanning();
        setStatus("IDLE");
        Alert.alert(
          "Workstation Not Found",
          `Could not locate "${pairedDeviceName}" on the network. Make sure the CLI is running.`,
          [
            {
              text: "Scan for Others",
              onPress: () => {
                setDiscoveryVisible(true);
                proceedWithScanning();
              },
            },
          ],
        );
      }
    }, 10000);
  };

  const proceedWithScanning = () => {
    setStatus("SCANNING");
    setDiscoveredDevices([]);
    discoveryService.startScanning((device) => {
      setDiscoveredDevices((prev) => {
        if (prev.find((d) => d.name === device.name)) return prev;
        return [...prev, device];
      });
    });
  };

  const handleSelectDevice = async (device: any, authSecret: string) => {
    const ip = device.addresses?.[0];
    if (!ip) {
      Alert.alert("Connection Error", "Device has no IP address.");
      return;
    }

    setSyncLoading(true);
    setSyncError(null);
    setStatus("SCANNING");

    const port = device.port || 8088;
    const deviceName = Constants.deviceName || "Mobile Hub";

    try {
      await syncService.connectToWorkstation(
        ip,
        port,
        authSecret,
        deviceName,
        async (batch, range) => {
          // Handled data ingestion
          const latest = batch[batch.length - 1];
          if (latest) setLatestTelemetry(latest);
          await refreshHistory();
          const timestamps = batch.map((t) => t.start_timestamp);
          await healthService.syncHealthData(timestamps);
          await refreshHistory();
          const lastSyncTs = await healthService.getLastSyncTimestamp();
          if (lastSyncTs) {
            setLastHealthSync(formatDateTime(lastSyncTs));
          }
        },
        async (newToken) => {
          // Auth Success!
          setSyncLoading(false);
          setDiscoveryVisible(false);
          setStatus("CONNECTED");
          setWorkstation(device.name);
          setPairedDeviceName(device.name);
          await databaseService.setMetadata(
            "paired_workstation_name",
            device.name,
          );

          if (newToken) {
            setSessionToken(newToken);
            await databaseService.setMetadata(
              "workstation_session_token",
              newToken,
            );
          }
        },
        (reason) => {
          console.error("Sync [Monitor]: Handshake failed.", reason);
          setSyncLoading(false);
          setStatus("IDLE");

          const msg = reason.includes("invalid_secret")
            ? "Invalid pairing code. Please check the CLI and try again."
            : "Authentication failed. Access denied.";

          if (discoveryVisible) {
            setSyncError(msg);
          } else {
            // If modal wasn't open (auto-connect), show alert and open modal
            Alert.alert("Authentication Failed", msg);
            setDiscoveryVisible(true);
            proceedWithScanning();
          }
        },
        () => {
          console.log("Sync [Monitor]: Connection lost or closed by peer.");
          setStatus("IDLE");
          setWorkstation(null);
        },
      );
    } catch (err) {
      setSyncLoading(false);
      Alert.alert("Auth Failed", "Could not authenticate with workstation.");
      setStatus("IDLE");
    }
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
            <GradientButton
              onPress={handleManualSync}
              loading={isSyncing}
              variant="ghost"
              size="small"
              icon={{
                ios: "arrow.triangle.2.circlepath",
                android: "sync",
                web: "refresh",
              }}
            />
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
              {status === "SCANNING" || status === "CONNECTED" ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <SymbolView
                  name={{
                    ios: "terminal.fill",
                    android: "terminal",
                    web: "code",
                  }}
                  size={24}
                  tintColor={Colors.subText}
                />
              )}
            </View>
            <Text style={styles.emptyText}>
              {status === "SCANNING"
                ? "Locating authorized workstation..."
                : status === "CONNECTED"
                  ? "Waiting for telemetry data..."
                  : "Monitoring station is currently offline."}
            </Text>
          </View>
        )}
      </ScrollView>

      <WorkstationDiscoveryModal
        visible={discoveryVisible}
        onClose={() => {
          setDiscoveryVisible(false);
          setSyncError(null);
          if (status === "SCANNING") stopMonitoring();
        }}
        onSelect={(device, code) => handleSelectDevice(device, code!)}
        discoveredDevices={discoveredDevices}
        isScanning={status === "SCANNING"}
        isConnecting={syncLoading}
        error={syncError}
      />

      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />

      <View style={styles.floatingContainer}>
        <GradientButton
          title={
            status === "IDLE"
              ? "INITIALIZE MONITOR STREAM"
              : status === "SCANNING"
                ? "ABORT SCANNING"
                : "TERMINATE DATA STREAM"
          }
          variant={status === "IDLE" ? "console" : "secondary"}
          onPress={status === "IDLE" ? startMonitoring : stopMonitoring}
          icon={
            status === "IDLE"
              ? {
                  ios: "play.fill",
                  android: "play_arrow",
                  web: "play_arrow",
                }
              : { ios: "stop.fill", android: "stop", web: "stop" }
          }
        />
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
    paddingBottom: 140, // Increased padding for technical console
    gap: 20,
  },
  card: {
    backgroundColor: Colors.surface_container,
    padding: 14,
    borderRadius: 6,
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
    paddingVertical: 30,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.surface_container_lowest,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
    borderStyle: "dashed",
    gap: 16,
  },
  emptyIconWell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface_container,
    justifyContent: "center",
    alignItems: "center",
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
    borderRadius: 6,
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
    borderRadius: 4,
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
  },
  technicalStatValue: {
    fontSize: 18,
    fontFamily: "SpaceGroteskBold",
    color: Colors.text,
  },
  floatingContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "transparent",
  },
});
