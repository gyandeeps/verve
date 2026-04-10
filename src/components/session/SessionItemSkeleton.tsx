import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { View } from "@/src/components/Themed";
import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet } from "react-native";

const { width } = Dimensions.get("window");

export function SessionItemSkeleton() {
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
    <View style={styles.cardWrapper}>
      <Animated.View style={[styles.card, { opacity }]}>
        <View style={styles.cardHeader}>
          <View>
            <View style={styles.skeletonTimestamp} />
            <View style={styles.skeletonAppName} />
          </View>
          <View style={styles.metricsRow}>
            <View style={styles.skeletonBpm} />
          </View>
        </View>

        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonSparkline} />

        <View style={styles.cardFooter}>
          <View style={styles.skeletonFooterLabel} />
          <View style={styles.skeletonFooterLabel} />
          <View style={styles.skeletonFooterLabel} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 12,
  },
  card: {
    borderRadius: Layout.borderRadius,
    padding: 16,
    gap: 6,
    backgroundColor: Colors.surface_container,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  skeletonTimestamp: {
    width: 80,
    height: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonAppName: {
    width: 140,
    height: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 4,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  skeletonBpm: {
    width: 40,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 4,
  },
  skeletonTitle: {
    width: "80%",
    height: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 4,
    marginTop: 8,
  },
  skeletonSparkline: {
    width: "100%",
    height: 20,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 4,
    marginVertical: 4,
  },
  cardFooter: {
    flexDirection: "row",
    marginTop: 8,
    gap: 16,
  },
  skeletonFooterLabel: {
    width: 60,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 4,
  },
});
