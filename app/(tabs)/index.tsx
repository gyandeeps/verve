import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { getInsightsSummaryPrompt } from "@/constants/Prompts";
import { databaseService } from "@/db/DatabaseService";
import { aiService, AIServiceState } from "@/services/AIService";
import { SymbolView } from "expo-symbols";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useFont } from "@shopify/react-native-skia";
import { Area, CartesianChart, Line, Scatter } from "victory-native";

type CombinedDataPoint = {
  active_app: string;
  window_title: string;
  work_ts: number;
  churn_rate: number;
  churn_scaled: number;
  type: string;
  value: number;
  bio_ts: number;
};

export default function InsightsScreen() {
  const [data, setData] = useState<CombinedDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [focusScore, setFocusScore] = useState(0);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [aiState, setAiState] = useState(AIServiceState.DISCONNECTED);
  const [modelExists, setModelExists] = useState(false);
  const [avgHrv, setAvgHrv] = useState(0);

  // Victory Native XL requires a Font for labels
  const font = useFont(require("../../assets/fonts/SpaceMono-Regular.ttf"), 10);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const results = await databaseService.getCombinedData(250);

      // Filter valid points for Phase 1 correlation
      const validPoints = (results as CombinedDataPoint[]).filter(
        (p) => p.value !== null && p.work_ts !== null,
      );

      // Sort chronologically
      const sorted = [...validPoints].sort((a, b) => a.work_ts - b.work_ts);

      // Trend Smoothing: Downsample and average values for a cleaner "trend" line (User Request)
      // We'll average in windows of 5 points to reduce noise/jitter
      const smoothed: CombinedDataPoint[] = [];
      const windowSize = 5;
      for (let i = 0; i < sorted.length; i += windowSize) {
        const chunk = sorted.slice(i, i + windowSize);
        const avgValue =
          chunk.reduce((acc, p) => acc + p.value, 0) / chunk.length;
        const avgChurn =
          chunk.reduce((acc, p) => acc + (p.churn_rate || 0), 0) / chunk.length;
        const midPoint = chunk[Math.floor(chunk.length / 2)];

        smoothed.push({
          ...midPoint,
          value: avgValue,
          churn_scaled: Math.min(100, Math.max(0, avgChurn * 80)), // Scale churn to match HRV y-axis (0-100)
        });
      }

      setData(smoothed);

      if (validPoints.length > 0) {
        const avg =
          validPoints.reduce((acc, p) => acc + p.value, 0) / validPoints.length;
        setAvgHrv(Math.round(avg));
        // Clinical Console mapping: 35-100ms SDNN maps to concentration/stress levels
        const score = Math.max(0, Math.min(100, (avg - 25) * 1.8));
        setFocusScore(Math.round(score));
      }
      console.log("Sync [Insight Data Resolved]:", smoothed.length);
    } catch (error) {
      console.error("Sync [Insight Error]:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
    const checkModel = async () => {
      const exists = await aiService.checkModelExists();
      setModelExists(exists);
    };
    checkModel();
  }, []);

  const handleDownloadModel = async () => {
    try {
      setAiState(AIServiceState.DOWNLOADING);
      await aiService.downloadModel((p) => setDownloadProgress(p));
      setModelExists(true);
      setAiState(AIServiceState.DISCONNECTED);
    } catch (e) {
      setAiState(AIServiceState.ERROR);
    }
  };

  const handleGenerateAISummary = async () => {
    if (!modelExists) return;

    setIsGenerating(true);
    setAiSummary("");
    setAiState(AIServiceState.INITIALIZING);

    try {
      // Create a localized prompt based on current data
      const workstationIntensity = data.length > 50 ? 85 : data.length * 1.5;

      // Extract Top Activities for context
      const appCounts: Record<string, number> = {};
      data.forEach((p) => {
        if (p.active_app) {
          appCounts[p.active_app] = (appCounts[p.active_app] || 0) + 1;
        }
      });
      const topApps = Object.entries(appCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name]) => name)
        .join(", ");

      const prompt = getInsightsSummaryPrompt(
        focusScore,
        avgHrv,
        workstationIntensity,
        topApps || "None identified",
      );

      await aiService.generateSummary(prompt, (token) => {
        // Specifically strip bolding (*) and markdown artifacts from the stream
        const cleanToken = token.replace(/[*#>`]/g, "");
        setAiSummary((prev) => prev + cleanToken);
      });
      setAiState(AIServiceState.READY);
    } catch (e) {
      console.error("[Insights] AI Error:", e);
      setAiState(AIServiceState.ERROR);
    } finally {
      setIsGenerating(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchInsights();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>
          Synthesizing Cognitive Correlation...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
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
        <Text style={styles.title}>Flow Intelligence</Text>
        <View style={styles.syncBadge}>
          <View style={styles.syncIndicator} />
          <Text style={styles.syncLabel}>BIO-FEEDBACK LOCAL-ONLY</Text>
        </View>
      </View>

      {/* Hero Module: Flow Score */}
      <View style={styles.heroCard}>
        <View style={styles.heroInfo}>
          <Text style={styles.heroLabel}>CURRENT FOCUS INDEX</Text>
          <Text style={styles.heroValue}>{focusScore}</Text>
        </View>
        <View style={styles.heroIconContainer}>
          <SymbolView
            name={{
              ios: "brain.head.profile",
              android: "psychology",
              web: "psychology",
            }}
            size={64}
            tintColor={focusScore > 60 ? Colors.tertiary : Colors.primary}
          />
        </View>
      </View>

      {/* Data Visualization Module */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Autonomic/Work Correlation</Text>
        <Text style={styles.sectionSubtitle}>
          Last 60 Minutes • SDNN Metric (ms)
        </Text>
      </View>

      {data.length > 2 ? (
        <View style={styles.chartContainer}>
          <CartesianChart
            data={data}
            xKey="work_ts"
            yKeys={["value", "churn_scaled"]}
            padding={20}
            axisOptions={{
              font,
              labelColor: Colors.subText,
              lineColor: Colors.outline_variant,
              tickCount: 5,
              formatXLabel: (ts: number) =>
                new Date(ts).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              formatYLabel: (v) => `${Math.round(v)}ms`,
              labelOffset: 12,
            }}
          >
            {({ points }) => (
              <>
                <Area
                  points={points.value}
                  y0={0}
                  color="rgba(173, 198, 255, 0.1)"
                  animate={{ type: "timing", duration: 500 }}
                />
                <Line
                  points={points.value}
                  color={Colors.primary}
                  strokeWidth={3}
                  animate={{ type: "timing", duration: 500 }}
                />
                <Area
                  points={points.churn_scaled}
                  y0={0}
                  color="rgba(78, 222, 163, 0.05)"
                  animate={{ type: "timing", duration: 500 }}
                />
                <Line
                  points={points.churn_scaled}
                  color={Colors.tertiary}
                  strokeWidth={2}
                  animate={{ type: "timing", duration: 500 }}
                />
              </>
            )}
          </CartesianChart>
          <View style={styles.chartFooter}>
            <View style={styles.legendColumn}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: Colors.primary },
                  ]}
                />
                <Text style={styles.legendLabel}>AUTONOMIC RECOVERY (HRV)</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: Colors.tertiary },
                  ]}
                />
                <Text style={styles.legendLabel}>
                  WORKSTATION INTENSITY (CLI)
                </Text>
              </View>
            </View>
            <Text style={styles.chartUnit}>SCALED METRIC (0-100)</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyText}>Building Signal Pipeline...</Text>
          <Text style={styles.emptySubText}>
            Awaiting sufficient sample density from workstation.
          </Text>
        </View>
      )}

      {/* Analytical Narrative Module */}
      <View style={styles.narrativeCard}>
        <View style={styles.narrativeHeader}>
          <SymbolView
            name="sparkles"
            size={16}
            tintColor={modelExists ? Colors.tertiary : Colors.subText}
          />
          <Text
            style={[
              styles.narrativeTitle,
              !modelExists && { color: Colors.subText },
            ]}
          >
            {isGenerating
              ? "NEURAL SYNTHESIS IN PROGRESS..."
              : "LOCAL LLM INSIGHTS (GEMMA 2 2B)"}
          </Text>
        </View>

        {!modelExists ? (
          <View style={styles.modelActionBox}>
            <Text style={styles.modelStatusText}>
              {aiState === AIServiceState.DOWNLOADING
                ? `Downloading Foundation Model (${Math.round(downloadProgress * 100)}%)...`
                : "AI engine is offline. Download the local GGUF model to enable high-fidelity narrative synthesis."}
            </Text>
            {aiState !== AIServiceState.DOWNLOADING && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleDownloadModel}
              >
                <Text style={styles.actionButtonText}>
                  INITIALIZE LLM ENGINE
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <View style={styles.narrativeContainer}>
              {aiSummary ? (
                aiSummary
                  .split("\n")
                  .filter((line) => line.trim().length > 0)
                  .map((line, idx) => (
                    <Text key={idx} style={styles.narrativeLine}>
                      {line.trim().startsWith("-") ||
                      line.trim().startsWith("•")
                        ? line.trim()
                        : `• ${line.trim()}`}
                    </Text>
                  ))
              ) : (
                <Text style={styles.narrativeText}>
                  {focusScore > 75
                    ? "Autonomic balance indicates sustained Parasympathetic dominance. Ideal state for complex refactoring and logical synthesis."
                    : focusScore > 45
                      ? "Cognitive load is within standard thresholds. Stability across context switches suggests effective task management."
                      : "Sympathetic arousal detected. Churn rate and HRV decline correlate with potential technical debt overhead."}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.actionButton,
                isGenerating && {
                  opacity: 0.5,
                  backgroundColor: Colors.surface,
                },
              ]}
              onPress={handleGenerateAISummary}
              disabled={isGenerating}
            >
              <Text style={styles.actionButtonText}>
                {isGenerating ? "GENERATING..." : "REFRESH AI NARRATIVE"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.appLegend}>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: Colors.tertiary }]}
            />
            <Text style={styles.legendLabel}>IDE ACTIVE</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: Colors.primary_container },
              ]}
            />
            <Text style={styles.legendLabel}>AUX. CONTEXT</Text>
          </View>
        </View>
      </View>
    </ScrollView>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    color: Colors.subText,
    fontFamily: "SpaceGrotesk",
    fontSize: 14,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: "InterExtraBold",
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
    borderRadius: Layout.borderRadius,
    backgroundColor: Colors.tertiary,
  },
  syncLabel: {
    fontSize: 9,
    fontFamily: "SpaceGroteskBold",
    color: Colors.tertiary,
    letterSpacing: 1,
  },
  heroCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface_container,
    padding: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
    borderRadius: Layout.borderRadius,
  },
  heroInfo: {
    flex: 1,
  },
  heroLabel: {
    fontSize: 11,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    marginBottom: 6,
    letterSpacing: 1,
  },
  heroValue: {
    fontSize: 64,
    fontFamily: "InterExtraBold",
    color: Colors.text,
    lineHeight: 64,
  },
  heroIconContainer: {
    opacity: 0.9,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "InterBold",
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
    marginTop: 2,
    textTransform: "uppercase",
  },
  chartContainer: {
    marginHorizontal: 20,
    height: 300,
    borderRadius: Layout.borderRadius,
    padding: 10,
    marginBottom: 28,
    backgroundColor: Colors.surface_container,
  },
  chartFooter: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  legendColumn: {
    gap: 4,
  },
  chartUnit: {
    fontSize: 9,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
    opacity: 0.5,
  },
  emptyChart: {
    height: 200,
    marginHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: Layout.borderRadius,
    backgroundColor: Colors.surface_container,
    marginBottom: 28,
    padding: 40,
  },
  emptyText: {
    color: Colors.text,
    fontFamily: "InterBold",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubText: {
    color: Colors.subText,
    fontFamily: "SpaceGrotesk",
    fontSize: 11,
    textAlign: "center",
    textTransform: "uppercase",
  },
  narrativeCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface_container,
    padding: 24,
    borderRadius: Layout.borderRadius,
    marginBottom: 20,
  },
  narrativeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  narrativeTitle: {
    fontSize: 11,
    fontFamily: "SpaceGroteskBold",
    color: Colors.primary,
    letterSpacing: 1,
  },
  narrativeContainer: {
    marginBottom: 24,
    gap: 8,
  },
  narrativeLine: {
    fontSize: 14,
    fontFamily: "Inter",
    color: Colors.text,
    lineHeight: 20,
    paddingLeft: 4,
  },
  narrativeText: {
    fontSize: 15,
    fontFamily: "Inter",
    color: Colors.text,
    lineHeight: 24,
  },
  appLegend: {
    flexDirection: "row",
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.outline_variant,
    paddingTop: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: Layout.borderRadius,
  },
  legendLabel: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    letterSpacing: 0.5,
  },
  modelActionBox: {
    paddingVertical: 16,
    gap: 16,
  },
  modelStatusText: {
    fontSize: 13,
    fontFamily: "Inter",
    color: Colors.subText,
    lineHeight: 20,
    marginBottom: 8,
  },
  actionButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: Layout.borderRadius,
  },
  actionButtonText: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    color: Colors.text,
    letterSpacing: 1,
  },
});
