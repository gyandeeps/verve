import { SymbolView } from "expo-symbols";
import React from "react";
import { Dimensions, StyleSheet, TouchableOpacity } from "react-native";
import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { Text, View } from "@/src/components/Themed";
import { SessionInsight } from "@/src/services/InsightsService";
import { formatDateTime } from "@/src/utils/format";
import { HRSparkline } from "./HRSparkline";

const { width } = Dimensions.get("window");

interface SessionItemProps {
  item: SessionInsight;
  onPress: (item: SessionInsight) => void;
}

export function SessionItem({ item, onPress }: SessionItemProps) {
  // Determine target app (one with most duration)
  const sorted = [...item.sessions_data].sort(
    (a, b) => b.duration_sec - a.duration_sec,
  );
  const dominantApp = sorted[0]?.app || "Unknown";
  const dominantTitle = sorted[0]?.title || "";

  // Focus Friction Heuristic: Churn > 1.5 AND BPM > 85
  const isFrictionHigh = item.churn_rate > 1.5 && item.avg_bpm > 85;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.timestamp}>
            {formatDateTime(item.start_timestamp)}
          </Text>
          <Text style={styles.appName} numberOfLines={1}>
            {dominantApp}
          </Text>
        </View>

        <View style={styles.metricsRow}>
          {isFrictionHigh && (
            <View style={styles.frictionBadge}>
              <SymbolView name="bolt.fill" tintColor="#FF3B30" size={14} />
              <Text style={styles.frictionText}>FRICTION</Text>
            </View>
          )}
          <View style={styles.bpmContainer}>
            <Text style={styles.bpmValue}>{item.avg_bpm || "--"}</Text>
            <Text style={styles.bpmLabel}>BPM</Text>
          </View>
        </View>
      </View>

      <Text style={styles.winTitle} numberOfLines={1}>
        {dominantTitle}
      </Text>

      {item.samples && item.samples.length > 1 && (
        <View style={styles.sparklineContainer}>
          <HRSparkline samples={item.samples} width={width - 52} height={20} />
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.footerLabel}>
          CHURN:{" "}
          <Text style={styles.footerValue}>{item.churn_rate.toFixed(1)}</Text>
        </Text>
        <Text style={styles.footerLabel}>
          IDLE:{" "}
          <Text style={styles.footerValue}>
            {Math.round(item.idle_timer / 1000)}s
          </Text>
        </Text>
        <Text style={styles.footerLabel}>
          BLOCKS:{" "}
          <Text style={styles.footerValue}>{item.sessions_data.length}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface_container,
    borderRadius: Layout.borderRadius,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  timestamp: {
    fontSize: 12,
    fontFamily: "SpaceGroteskBold",
    color: Colors.primary,
    marginBottom: 4,
  },
  appName: {
    fontSize: 16,
    fontFamily: "InterBold",
    color: Colors.text,
    maxWidth: width * 0.6,
  },
  winTitle: {
    fontSize: 12,
    fontFamily: "Inter",
    color: Colors.subText,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bpmContainer: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  bpmValue: {
    fontSize: 18,
    fontFamily: "SpaceGroteskBold",
    color: Colors.text,
  },
  bpmLabel: {
    fontSize: 8,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    marginTop: -2,
  },
  frictionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  frictionText: {
    fontSize: 9,
    fontFamily: "SpaceGroteskBold",
    color: "#FF3B30",
    marginLeft: 4,
  },
  sparklineContainer: {
    marginVertical: 4,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 4,
    borderRadius: 4,
  },
  cardFooter: {
    flexDirection: "row",
    paddingTop: 8,
  },
  footerLabel: {
    fontSize: 11,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    marginRight: 16,
  },
  footerValue: {
    color: Colors.text,
    fontFamily: "SpaceGroteskBold",
  },
});
