import Colors from "@/constants/Colors";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

export function StatsLoadingSkeleton() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [opacity]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity, gap: 20 }}>
        {/* StatCard Skeletons */}
        <View style={styles.card}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonValue} />
          <View style={styles.skeletonSubtext} />
        </View>

        <View style={styles.card}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonValue} />
          <View style={styles.skeletonSubtext} />
        </View>

        <View style={styles.card}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonValue} />
          <View style={styles.skeletonSubtext} />
        </View>

        {/* Breakdown Card Skeleton */}
        <View style={styles.card}>
          <View style={styles.skeletonTitle} />
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownColumn}>
              <View style={styles.skeletonBreakdownLabel} />
              <View style={styles.skeletonBreakdownValue} />
            </View>
            <View style={styles.breakdownColumn}>
              <View style={styles.skeletonBreakdownLabel} />
              <View style={styles.skeletonBreakdownValue} />
            </View>
            <View style={styles.breakdownColumn}>
              <View style={styles.skeletonBreakdownLabel} />
              <View style={styles.skeletonBreakdownValue} />
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  card: {
    backgroundColor: Colors.surface_container,
    borderRadius: 6,
    padding: 20,
  },
  skeletonTitle: {
    width: 120,
    height: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 4,
    marginBottom: 12,
  },
  skeletonValue: {
    width: 160,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonSubtext: {
    width: "90%",
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 4,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
  },
  breakdownColumn: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  skeletonBreakdownLabel: {
    width: 60,
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 4,
  },
  skeletonBreakdownValue: {
    width: 40,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
  },
});
