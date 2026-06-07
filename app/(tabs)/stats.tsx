import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { StatCard } from "@/src/components/StatCard";
import { TimeframeSelector } from "@/src/components/TimeframeSelector";
import { StatsLoadingSkeleton } from "@/src/components/common/StatsLoadingSkeleton";
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
import Animated, { FadeInUp } from "react-native-reanimated";

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
  const [timeframe, setTimeframe] = useState<Timeframe>("today");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isInitialLoadRef = React.useRef(true);

  const [topApps, setTopApps] = useState<TopAppTime[]>([]);
  const [topStressors, setTopStressors] = useState<AppStressTrigger[]>([]);
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [recoveryScore, setRecoveryScore] = useState(0);
  const [breakdown, setBreakdown] = useState<{
    deepFlowCount: number;
    thinkingStressCount: number;
    reactivePanicCount: number;
    total: number;
  } | null>(null);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      try {
        const [apps, stressors, stats, recResult, breakdownResult] =
          await Promise.all([
            statsService.getTopAppsByTime(timeframe),
            statsService.getTopStressTriggers(timeframe),
            statsService.getStatsOverview(timeframe),
            statsService.getRecoveryEfficiency(timeframe),
            statsService.getCognitiveStatesBreakdown(timeframe),
          ]);
        setTopApps(apps);
        setTopStressors(stressors);
        setOverview(stats);
        setRecoveryScore(recResult.score);
        setBreakdown(breakdownResult);
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
      loadData(!isInitialLoadRef.current);
      isInitialLoadRef.current = false;
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
        <Animated.View
          entering={FadeInUp.springify().damping(15).stiffness(100).delay(100)}
          style={styles.header}
        >
          <Text style={styles.title}>Cognitive Statistics</Text>
          <View style={styles.syncBadge}>
            <View style={styles.syncIndicator} />
            <Text style={styles.syncLabel}>
              HISTORICAL TRENDS • LOCAL-ONLY ANALYSIS
            </Text>
          </View>
        </Animated.View>

        <View style={styles.mainContent}>
          <Animated.View
            entering={FadeInUp.springify()
              .damping(15)
              .stiffness(100)
              .delay(150)}
          >
            <TimeframeSelector selected={timeframe} onSelect={setTimeframe} />
          </Animated.View>

          {loading ? (
            <StatsLoadingSkeleton />
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

              <StatCard
                title="RECOVERY EFFICIENCY"
                value={recoveryScore > 0 ? `${recoveryScore} BPM/m` : "--"}
                subtext={
                  recoveryScore > 12
                    ? "Excellent cardiovascular recovery rate."
                    : recoveryScore > 0
                      ? "Standard cardiovascular recovery rate."
                      : "Insufficient resting health events."
                }
                icon={{
                  ios: "heart.text.square",
                  android: "favorite",
                  web: "favorite",
                }}
              />

              {/* Cognitive States Breakdown */}
              {breakdown && breakdown.total > 0 && (
                <Animated.View
                  entering={FadeInUp.springify()
                    .damping(15)
                    .stiffness(100)
                    .delay(200)}
                  style={styles.sectionCard}
                >
                  <Text style={styles.sectionHeader}>
                    COGNITIVE STATES BREAKDOWN
                  </Text>
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownColumn}>
                      <Text
                        style={[
                          styles.breakdownLabel,
                          { color: Colors.tertiary },
                        ]}
                      >
                        DEEP FLOW
                      </Text>
                      <Text style={styles.breakdownValue}>
                        {breakdown.deepFlowCount}
                      </Text>
                    </View>
                    <View style={styles.breakdownColumn}>
                      <Text
                        style={[
                          styles.breakdownLabel,
                          { color: Colors.primary },
                        ]}
                      >
                        THINKING STRESS
                      </Text>
                      <Text style={styles.breakdownValue}>
                        {breakdown.thinkingStressCount}
                      </Text>
                    </View>
                    <View style={styles.breakdownColumn}>
                      <Text
                        style={[
                          styles.breakdownLabel,
                          { color: Colors.secondary },
                        ]}
                      >
                        REACTIVE PANIC
                      </Text>
                      <Text style={styles.breakdownValue}>
                        {breakdown.reactivePanicCount}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* List Top Stressors */}
              {topStressors.length > 0 && (
                <Animated.View
                  entering={FadeInUp.springify()
                    .damping(15)
                    .stiffness(100)
                    .delay(250)}
                  style={styles.sectionCard}
                >
                  <Text style={styles.sectionHeader}>HIGHEST HR TRIGGERS</Text>
                  {topStressors.map((s, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.listItem,
                        {
                          backgroundColor:
                            idx % 2 === 0
                              ? Colors.surface_container_lowest
                              : "transparent",
                        },
                      ]}
                    >
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
                </Animated.View>
              )}

              {/* List Top Apps */}
              {topApps.length > 0 && (
                <Animated.View
                  entering={FadeInUp.springify()
                    .damping(15)
                    .stiffness(100)
                    .delay(300)}
                  style={styles.sectionCard}
                >
                  <Text style={styles.sectionHeader}>
                    MOST USED APPLICATIONS
                  </Text>
                  {topApps.map((a, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.listItem,
                        {
                          backgroundColor:
                            idx % 2 === 0
                              ? Colors.surface_container_lowest
                              : "transparent",
                        },
                      ]}
                    >
                      <Text style={styles.listItemTitle}>
                        {a.app_name || "Unknown"}
                      </Text>
                      <Text style={styles.listItemValue}>
                        {formatDuration(a.total_duration_sec)}
                      </Text>
                    </View>
                  ))}
                </Animated.View>
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 2,
    borderRadius: 4,
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
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
  },
  breakdownColumn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  breakdownLabel: {
    fontFamily: "SpaceGroteskBold",
    fontSize: 9,
    letterSpacing: 0.5,
  },
  breakdownValue: {
    fontFamily: "SpaceGroteskBold",
    fontSize: 24,
    color: Colors.text,
  },
});
