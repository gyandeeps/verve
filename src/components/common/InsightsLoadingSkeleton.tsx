import Colors from "@/constants/Colors";
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

export function InsightsLoadingSkeleton() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  const [logIndex, setLogIndex] = useState(0);

  const logs = [
    "INITIALIZING COGNITIVE INTERFACE...",
    "ESTABLISHING SECURE OFFLINE BRIDGE...",
    "FETCHING WATERMARK ANCHORS FROM APPLE HEALTHKIT...",
    "CORRELATING PHYSIOLOGICAL BPM SIGNAL STREAMS...",
    "HYDRATING DATABASE FROM RECENT WORKSTATION OUTBOX...",
    "SYNTHESIZING NEURAL DECOMPRESSION REPORT...",
  ];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Rotate simulated clinical logging steps every 1.5s
    const interval = setInterval(() => {
      setLogIndex((prev) => (prev + 1) % logs.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [opacity]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity, gap: 20 }}>
        {/* Pulsing Header */}
        <View style={styles.header}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
        </View>

        {/* Pulsing Focus Index Hero card */}
        <View style={styles.heroCard}>
          <View style={{ flex: 1 }}>
            <View style={styles.skeletonHeroLabel} />
            <View style={styles.skeletonHeroValue} />
          </View>
          <View style={{ alignItems: "center" }}>
            <View style={styles.skeletonHeroLabel} />
            <View style={styles.skeletonHeroValueSmall} />
          </View>
        </View>

        {/* Pulsing Chart Outline */}
        <View style={styles.chartContainer}>
          <View style={styles.skeletonChartHeader} />
          <View style={styles.skeletonChartBody}>
            {/* Horizontal Grid lines */}
            <View style={styles.gridLine} />
            <View style={styles.gridLine} />
            <View style={styles.gridLine} />
          </View>
          <View style={styles.skeletonChartFooter} />
        </View>

        {/* Monospaced Clinical Logs Readout Box */}
        <View style={styles.consoleWell}>
          <Text style={styles.consoleTitle}>
            SYSTEM DATA HYDRATION SEQUENCE
          </Text>
          {logs.slice(0, logIndex + 1).map((log, idx) => (
            <Text key={idx} style={styles.consoleLogText}>
              &gt; {log}
            </Text>
          ))}
          <Text style={styles.consoleLogTextBlinking}>
            &gt; HYDRATION_PENDING_...
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    marginBottom: 10,
  },
  skeletonTitle: {
    width: 120,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonSubtitle: {
    width: 220,
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 4,
  },
  heroCard: {
    backgroundColor: Colors.surface_container,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 6,
  },
  skeletonHeroLabel: {
    width: 110,
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonHeroValue: {
    width: 70,
    height: 38,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
  },
  skeletonHeroValueSmall: {
    width: 50,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
  },
  chartContainer: {
    backgroundColor: Colors.surface_container,
    borderRadius: 6,
    padding: 20,
    height: 200,
    gap: 16,
  },
  skeletonChartHeader: {
    width: 180,
    height: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 4,
  },
  skeletonChartBody: {
    flex: 1,
    justifyContent: "space-between",
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    paddingLeft: 8,
    paddingBottom: 8,
  },
  gridLine: {
    height: 1,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  skeletonChartFooter: {
    width: 140,
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 4,
  },
  consoleWell: {
    backgroundColor: Colors.surface_container_lowest,
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
    minHeight: 140,
  },
  consoleTitle: {
    fontSize: 9,
    fontFamily: "SpaceGroteskBold",
    color: Colors.primary,
    marginBottom: 8,
    letterSpacing: 1,
  },
  consoleLogText: {
    fontSize: 9,
    fontFamily: "SpaceMono",
    color: Colors.subText,
    lineHeight: 14,
    marginVertical: 1,
  },
  consoleLogTextBlinking: {
    fontSize: 9,
    fontFamily: "SpaceMono",
    color: Colors.primary,
    lineHeight: 14,
    marginVertical: 1,
    opacity: 0.8,
  },
});
