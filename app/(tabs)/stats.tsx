import Colors from "@/constants/Colors";
import { StatCard } from "@/src/components/StatCard";
import { TimeframeSelector } from "@/src/components/TimeframeSelector";
import {
  AppStressTrigger,
  StatsOverview,
  Timeframe,
  TopAppTime,
  statsService,
} from "@/src/services/StatsService";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Layout from "@/constants/Layout";

// Format seconds into a human friendly string (e.g., 2h 15m)
function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export default function StatsScreen() {
  const [timeframe, setTimeframe] = useState<Timeframe>("last7days");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [topApps, setTopApps] = useState<TopAppTime[]>([]);
  const [topStressors, setTopStressors] = useState<AppStressTrigger[]>([]);
  const [overview, setOverview] = useState<StatsOverview | null>(null);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      try {
        const [apps, stressors, stats] = await Promise.all([
          statsService.getTopAppsByTime(timeframe),
          statsService.getTopStressTriggers(timeframe),
          statsService.getStatsOverview(timeframe),
        ]);
        setTopApps(apps);
        setTopStressors(stressors);
        setOverview(stats);
      } catch (err) {
        console.error("Failed to load stats", err);
      } finally {
        if (!isRefresh) setLoading(false);
        setRefreshing(false);
      }
    },
    [timeframe],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Cognitive Statistics</Text>
          <View style={styles.syncBadge}>
            <View style={styles.syncIndicator} />
            <Text style={styles.syncLabel}>
              HISTORICAL TRENDS • LOCAL-ONLY ANALYSIS
            </Text>
          </View>
        </View>

        <View style={styles.mainContent}>
          <TimeframeSelector selected={timeframe} onSelect={setTimeframe} />

          {loading ? (
            <ActivityIndicator
              size="large"
              color={Colors.primary}
              style={{ marginTop: 40 }}
            />
          ) : (
            <>
              {/* Overview Cards */}
              <StatCard
                title="DEEP FLOW TIME"
                value={formatDuration(overview?.deep_flow_time_sec || 0)}
                subtext="Periods of sustained low context-churn."
                icon={{
                  ios: "timer",
                  android: "timer",
                  web: "timer",
                }}
              />

              <StatCard
                title="AVERAGE CHURN RATE"
                value={(overview?.average_churn_rate || 0).toFixed(1)}
                subtext="App switches per 120s observation window."
                icon={{
                  ios: "arrow.triangle.2.circlepath",
                  android: "sync",
                  web: "sync",
                }}
              />

              {/* List Top Stressors */}
              {topStressors.length > 0 && (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionHeader}>HIGHEST HR TRIGGERS</Text>
                  {topStressors.map((s, idx) => (
                    <View key={idx} style={styles.listItem}>
                      <Text style={styles.listItemTitle}>
                        {s.primary_app || "Unknown"}
                      </Text>
                      <View style={styles.listItemValueContainer}>
                        <Text style={styles.listItemValueHigh}>
                          {Math.round(s.peak_bpm)} BPM{" "}
                        </Text>
                        <Text style={styles.listItemValueSub}>
                          (AVG: {Math.round(s.overall_avg_bpm)})
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* List Top Apps */}
              {topApps.length > 0 && (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionHeader}>
                    MOST USED APPLICATIONS
                  </Text>
                  {topApps.map((a, idx) => (
                    <View key={idx} style={styles.listItem}>
                      <Text style={styles.listItemTitle}>
                        {a.app_name || "Unknown"}
                      </Text>
                      <Text style={styles.listItemValue}>
                        {formatDuration(a.total_duration_sec)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {!topStressors.length && !topApps.length && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    Insufficient telemetry data for this vector.
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  mainContent: {
    paddingHorizontal: Layout.horizontalPadding,
  },
  header: {
    paddingHorizontal: Layout.horizontalPadding,
    marginBottom: 20,
  },
  title: {
    fontFamily: "InterExtraBold",
    fontSize: 28,
    color: Colors.text,
    letterSpacing: -1,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  syncIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.tertiary,
  },
  syncLabel: {
    fontSize: 9,
    fontFamily: "SpaceGroteskBold",
    color: Colors.tertiary,
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: Colors.surface_container,
    borderRadius: Layout.borderRadius,
    padding: 14,
    marginBottom: 20,
  },
  sectionHeader: {
    fontFamily: "SpaceGroteskBold",
    fontSize: 11,
    color: Colors.subText,
    marginBottom: 16,
    letterSpacing: 1,
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface_container_highest,
  },
  listItemTitle: {
    fontFamily: "InterSemi",
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  listItemValueContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  listItemValue: {
    fontFamily: "SpaceGroteskSemi",
    fontSize: 14,
    color: Colors.text,
  },
  listItemValueHigh: {
    fontFamily: "SpaceGroteskBold",
    fontSize: 14,
    color: Colors.secondary, // Stress rose
  },
  listItemValueSub: {
    fontFamily: "SpaceGrotesk",
    fontSize: 12,
    color: Colors.subText,
    marginLeft: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyStateText: {
    fontFamily: "Inter",
    fontSize: 14,
    color: Colors.subText,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
