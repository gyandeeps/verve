import { databaseService } from "@/db/DatabaseService";
import { healthService } from "@/services/HealthService";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";

export default function DevSettingsScreen() {
  const [count, setCount] = useState(10);
  const [windowMinutes, setWindowMinutes] = useState(60); // default 1 hour
  const [isInjecting, setIsInjecting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Guard: If we are not in development mode, don't show the dev tools
  if (!__DEV__) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>CogniStaff v1.0</Text>
        <Text style={styles.description}>Medical Hub Interface</Text>
        <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
      </View>
    );
  }

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
      await healthService.seedMockData(count, windowMinutes);
      // After injection, trigger a sync to pull the newly added data into our DB
      await healthService.syncHealthData();
      Alert.alert(
        "Success",
        `Injected ${count} HRV records into HealthKit and synced to database.`,
      );
    } catch (err) {
      Alert.alert("Error", "Failed to inject mock data. Check permissions.");
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Developer Console</Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual HRV Injection</Text>
        <Text style={styles.description}>
          Seed mock Heart Rate Variability (SDNN) data into the iOS HealthKit
          store for testing and visualization.
        </Text>

        <View style={styles.optionGroup}>
          <Text style={styles.optionLabel}>SAMPLE COUNT</Text>
          <View style={styles.buttonSegment}>
            {[5, 10, 25, 50].map((v) => (
              <TouchableOpacity
                key={v}
                style={[
                  styles.segmentButton,
                  count === v && styles.activeSegment,
                ]}
                onPress={() => setCount(v)}
              >
                <Text
                  style={[styles.segmentText, count === v && styles.activeText]}
                >
                  {v}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.optionGroup}>
          <Text style={styles.optionLabel}>TIME FRAME (LOOKBACK)</Text>
          <View style={styles.buttonSegment}>
            {[
              { label: "Last 1H", val: 60 },
              { label: "Last 6H", val: 360 },
              { label: "Last 24H", val: 1440 },
              { label: "Last 7D", val: 10080 },
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

        <TouchableOpacity
          style={styles.injectButton}
          onPress={handleInject}
          disabled={isInjecting}
        >
          {isInjecting ? (
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <Text style={styles.injectButtonText}>Inject & Sync</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { marginTop: 20 }]}>
        <Text style={[styles.sectionTitle, { color: Colors.secondary }]}>
          Database Operations
        </Text>
        <Text style={styles.description}>
          Reset all local storage, including history, workstation context, and
          biometric logs.
        </Text>

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

      <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 30,
    backgroundColor: Colors.surface,
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
    marginBottom: 8,
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
