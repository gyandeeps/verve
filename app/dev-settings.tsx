import { databaseService } from "@/db/DatabaseService";
import { aiService } from "@/services/AIService";
import { healthService } from "@/services/health-service";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { Text, View } from "@/src/components/Themed";

export default function DevSettingsScreen() {
  const [count, setCount] = useState(2);
  const [windowMinutes, setWindowMinutes] = useState(15); // default to a smaller window
  const [isInjecting, setIsInjecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isDeletingModel, setIsDeletingModel] = useState(false);

  const isDev = __DEV__;

  const handleClearDatabase = () => {
    Alert.alert(
      "Confirm Reset",
      "This will permanently delete all telemetry, biometric data, and sync anchors from the local SQLite database. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: async () => {
            setIsClearing(true);
            try {
              await databaseService.clearAllTables();
              Alert.alert("Database Purged", "All tables are now empty.");
            } catch (err) {
              Alert.alert("Error", "Failed to clear database.");
            } finally {
              setIsClearing(false);
            }
          },
        },
      ],
    );
  };

  const handleInject = async () => {
    setIsInjecting(true);
    try {
      const { count: injectedTotal } = await healthService.seedMockData(
        count,
        windowMinutes,
      );

      if (injectedTotal === 0) {
        Alert.alert(
          "No Telemetry",
          "No telemetry records found in this time frame. Mock seeding requires existing workstation events to provide context.",
        );
        return;
      }

      const storeName = Platform.OS === "ios" ? "HealthKit" : "Health Connect";
      Alert.alert(
        "Seeded Successfully",
        `Injected ${injectedTotal} HR records into ${storeName}. Use 'Sync Local DB' to pull them into Verve.`,
      );
    } catch (err) {
      Alert.alert("Error", "Failed to inject mock data. Check permissions.");
    } finally {
      setIsInjecting(false);
    }
  };

  const handleSyncOnly = async () => {
    setIsSyncing(true);
    try {
      const result = await healthService.catchUpSync(windowMinutes);
      if (result.samplesCount > 0) {
        Alert.alert(
          "Sync Complete",
          `Manual contextual sync performed for the last ${windowMinutes} minutes. Stored ${result.storedCount}/${result.samplesCount} samples.`,
        );
      } else {
        Alert.alert(
          "No New Data",
          `No new biometric data found for the existing workstation events in the last ${windowMinutes} minutes.`,
        );
      }
    } catch (err) {
      Alert.alert("Error", "Manual sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInjectAndSync = async () => {
    setIsInjecting(true);
    setIsSyncing(true);
    try {
      const { count: injectedTotal, contextTimestamps } =
        await healthService.seedMockData(count, windowMinutes);

      if (injectedTotal === 0) {
        Alert.alert(
          "No Telemetry",
          "No telemetry records found in this time frame. Heart Rate data must be associated with telemetry events.",
        );
        return;
      }

      const minTs = Math.min(...contextTimestamps);
      const maxTs = Math.max(...contextTimestamps);
      const result = await healthService.syncHealthData(
        minTs,
        maxTs,
        contextTimestamps,
      );

      const storeName = Platform.OS === "ios" ? "HealthKit" : "Health Connect";
      Alert.alert(
        "Success",
        `Injected ${injectedTotal} records into ${storeName} and performed a contextual sync (stored ${result.storedCount}/${result.samplesCount} samples).`,
      );
    } catch (err) {
      Alert.alert("Error", "Inject & Sync failed.");
    } finally {
      setIsInjecting(false);
      setIsSyncing(false);
    }
  };

  const handleDeleteModel = () => {
    Alert.alert(
      "Confirm Model Deletion",
      "This will remove the local LLM model (Phi-4, ~2.5GB) from your device's storage. You will need to download it again to use offline AI features. Proceed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Delete Model",
          style: "destructive",
          onPress: async () => {
            setIsDeletingModel(true);
            try {
              await aiService.deleteModel();
              Alert.alert(
                "Model Removed",
                "The local model file has been deleted.",
              );
            } catch (err) {
              Alert.alert("Error", "Failed to delete the model file.");
            } finally {
              setIsDeletingModel(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isDev ? "Developer Console" : "System Settings"}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <SymbolView
            name={{ ios: "xmark.circle.fill", android: "close", web: "close" }}
            size={24}
            tintColor={Colors.subText}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.separator} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {isDev && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Contextual HR Injection</Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    "Contextual HR Injection",
                    "Seed mock Heart Rate (BPM) data relative to existing workstation telemetry. Generates samples within +/- 5s of each event. Range: 40–140 BPM.",
                  )
                }
              >
                <SymbolView
                  name={{
                    ios: "info.circle",
                    android: "info",
                    web: "info",
                  }}
                  size={18}
                  tintColor={Colors.subText}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.optionGroup}>
              <Text style={styles.optionLabel}>
                SAMPLES PER EVENT (DENSITY)
              </Text>
              <View style={styles.buttonSegment}>
                {[1, 2, 3, 15].map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[
                      styles.segmentButton,
                      count === v && styles.activeSegment,
                    ]}
                    onPress={() => setCount(v)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        count === v && styles.activeText,
                      ]}
                    >
                      {v}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.optionGroup}>
              <Text style={styles.optionLabel}>TIME FRAME (LOOKBACK)</Text>
              <View style={styles.buttonSegment}>
                {[
                  { label: "Last 15m", val: 15 },
                  { label: "Last 30m", val: 30 },
                  { label: "Last 1H", val: 60 },
                  { label: "Last 2H", val: 120 },
                ].map((v) => (
                  <TouchableOpacity
                    key={v.label}
                    style={[
                      styles.segmentButton,
                      windowMinutes === v.val && styles.activeSegment,
                    ]}
                    onPress={() => setWindowMinutes(v.val)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        windowMinutes === v.val && styles.activeText,
                      ]}
                    >
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.injectButton, { flex: 1, marginTop: 0 }]}
                onPress={handleInject}
                disabled={isInjecting || isSyncing}
              >
                {isInjecting ? (
                  <ActivityIndicator color={Colors.surface} />
                ) : (
                  <Text style={styles.injectButtonText}>Inject Mock</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.injectButton,
                  { flex: 1, marginTop: 0, backgroundColor: Colors.tertiary },
                ]}
                onPress={handleSyncOnly}
                disabled={isSyncing || isInjecting}
              >
                {isSyncing ? (
                  <ActivityIndicator color={Colors.surface} />
                ) : (
                  <Text style={styles.injectButtonText}>Sync DB</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.injectButton,
                {
                  backgroundColor: Colors.surface_container_highest,
                  marginTop: 12,
                },
              ]}
              onPress={handleInjectAndSync}
              disabled={isInjecting || isSyncing}
            >
              {isInjecting && isSyncing ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <Text style={[styles.injectButtonText, { color: Colors.text }]}>
                  Inject & Sync Both
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.section, { marginTop: 20 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: Colors.secondary }]}>
              Database Operations
            </Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Database Operations",
                  "Reset all local storage, including history, workstation context, and biometric logs.",
                )
              }
            >
              <SymbolView
                name={{
                  ios: "info.circle",
                  android: "info",
                  web: "info",
                }}
                size={18}
                tintColor={Colors.subText}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.injectButton, { backgroundColor: Colors.secondary }]}
            onPress={handleClearDatabase}
            disabled={isClearing}
          >
            {isClearing ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <Text style={styles.injectButtonText}>Clear Local Database</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { marginTop: 20 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: Colors.secondary }]}>
              AI Model Management
            </Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "AI Model Management",
                  "The local LLM is stored in your documents directory. Deleting it frees up about 2.5GB of space.",
                )
              }
            >
              <SymbolView
                name={{
                  ios: "info.circle",
                  android: "info",
                  web: "info",
                }}
                size={18}
                tintColor={Colors.subText}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.injectButton, { backgroundColor: Colors.secondary }]}
            onPress={handleDeleteModel}
            disabled={isDeletingModel}
          >
            {isDeletingModel ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <Text style={styles.injectButtonText}>Delete Local Model</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 24,
    fontFamily: "InterExtraBold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 30,
    paddingTop: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  closeButton: {
    padding: 4,
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: "100%",
    backgroundColor: Colors.outline_variant,
  },
  section: {
    backgroundColor: Colors.surface_container,
    borderRadius: Layout.borderRadius,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "InterBold",
    color: Colors.primary,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 13,
    fontFamily: "Inter",
    color: Colors.subText,
    lineHeight: 18,
    marginBottom: 24,
  },
  optionGroup: {
    marginBottom: 20,
  },
  optionLabel: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    marginBottom: 10,
    letterSpacing: 1,
  },
  buttonSegment: {
    flexDirection: "row",
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    height: 40,
    borderRadius: Layout.borderRadius,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  activeSegment: {
    borderColor: Colors.tertiary,
    backgroundColor: "rgba(78, 222, 163, 0.1)",
  },
  segmentText: {
    fontSize: 12,
    fontFamily: "InterSemi",
    color: Colors.text,
  },
  activeText: {
    color: Colors.tertiary,
  },
  injectButton: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Layout.borderRadius,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  injectButtonText: {
    color: Colors.surface,
    fontSize: 14,
    fontFamily: "InterBold",
    letterSpacing: 0.5,
  },
});
