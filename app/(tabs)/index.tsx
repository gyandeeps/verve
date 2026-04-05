import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { databaseService } from "@/db/DatabaseService";
import {
  aiService,
  AIServiceState,
  AnalysisResult,
  TelemetryEvent,
} from "@/services/AIService";
import { Text, View } from "@/src/components/Themed";
import { useFont } from "@shopify/react-native-skia";
import { SymbolView } from "expo-symbols";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Area, CartesianChart, Line } from "victory-native";

import { CombinedDataPoint, insightsService } from "@/services/InsightsService";
import { healthService } from "@/services/health-service";

export default function InsightsScreen() {
  const [data, setData] = useState<CombinedDataPoint[]>([]);
  const [rawData, setRawData] = useState<CombinedDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [focusScore, setFocusScore] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [aiState, setAiState] = useState(AIServiceState.DISCONNECTED);
  const [modelExists, setModelExists] = useState(false);
  const [avgHr, setAvgHr] = useState(0);

  const font = useFont(require("../../assets/fonts/SpaceMono-Regular.ttf"), 10);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const { smoothed, raw, avgHr, focusScore } =
        await insightsService.getInsightsData(200);

      setData(smoothed);
      // Keep a copy of the pre-smoothed raw records for the LLM —
      // it needs sequential, unaveraged data for accurate temporal correlation.
      setRawData(raw);

      setAvgHr(avgHr);
      setFocusScore(focusScore);
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

    // Release the native llama context when this screen unmounts.
    // In dev, Fast Refresh triggers unmount/remount — releasing first
    // prevents the TurboModuleManager timeout during inference.
    return () => {
      aiService.release();
    };
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
    setAnalysis(null);

    try {
      // Phase 1: Initialize the model context if it isn't already loaded.
      // This is intentionally separated from the analysis so the user sees
      // the INITIALIZING state during the heavy initLlama() call.
      const currentState = aiService.getState().state;
      if (currentState !== AIServiceState.READY) {
        setAiState(AIServiceState.INITIALIZING);
        await aiService.initialize();
      }

      // Phase 2: Run the analysis.
      setAiState(AIServiceState.READY);

      // Token budget: system_prompt(~120) + 10 events×~30 tokens + output(~300) = ~730/3072 tokens.
      // 10 events is enough for the model to detect patterns without blowing the context.
      const payload: TelemetryEvent[] = insightsService.buildAIPayload(
        rawData,
        10,
      );

      const result = await aiService.analyzeCognitiveState(payload);
      setAnalysis(result);

      if (result.app_categories && typeof result.app_categories === "object") {
        for (const [app, cat] of Object.entries(result.app_categories)) {
          // Defensive check against model hallucinations
          if (app && cat) {
            await databaseService.setAppCategory(app, String(cat));
          }
        }
      }

      setAiState(AIServiceState.READY);
    } catch (e) {
      console.error("[Insights] AI Error:", e);
      setAiState(AIServiceState.ERROR);
    } finally {
      setIsGenerating(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Sync any heart rate data that may have been delayed by the OS
      await healthService.catchUpSync();
    } catch (err) {
      console.error("[Insights] Delayed HR Sync failed:", err);
    }
    fetchInsights();
  };

  if ((loading || !font) && !refreshing) {
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

      <View style={styles.heroCard}>
        <View style={styles.heroInfo}>
          <Text style={styles.heroLabel}>CURRENT FOCUS INDEX</Text>
          <Text style={styles.heroValue}>{focusScore}</Text>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroSecondary}>
          <View style={styles.secondaryInfo}>
            <Text style={styles.heroLabel}>AVG HEART RATE</Text>
            <Text style={styles.secondaryValue}>
              {avgHr} <Text style={styles.secondaryUnit}>BPM</Text>
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Cardiac/Work Correlation</Text>
        <Text style={styles.sectionSubtitle}>
          Last 60 Minutes • Heart Rate (BPM)
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
              formatYLabel: (v) => `${Math.round(v)} bpm`,
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
                <Text style={styles.legendLabel}>HEART RATE (BPM)</Text>
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
            {isGenerating && aiState === AIServiceState.INITIALIZING
              ? "PREPARING MODEL..."
              : isGenerating
                ? "NEURAL SYNTHESIS IN PROGRESS..."
                : `LOCAL LLM INSIGHTS (PHI-4 MINI)`}
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
              {analysis ? (
                <>
                  <View style={styles.analysisSection}>
                    <Text style={styles.analysisLabel}>OVERALL STATE</Text>
                    <Text
                      style={[styles.analysisValue, { color: Colors.primary }]}
                    >
                      {analysis.overall_state}
                    </Text>
                  </View>

                  <View style={styles.analysisSection}>
                    <Text style={styles.analysisLabel}>STRESS TRIGGERS</Text>
                    <View style={styles.chipContainer}>
                      {analysis.stress_triggers.map((app, i) => (
                        <View key={i} style={styles.chip}>
                          <Text style={styles.chipText}>{app}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.analysisSection}>
                    <Text style={styles.analysisLabel}>CHURN IMPACT</Text>
                    <Text style={styles.narrativeText}>
                      {analysis.churn_impact}
                    </Text>
                  </View>

                  <View style={styles.feedbackBox}>
                    <Text style={styles.feedbackText}>
                      "{analysis.actionable_feedback}"
                    </Text>
                  </View>
                </>
              ) : (
                <Text
                  style={[
                    styles.narrativeText,
                    { opacity: 0.6, fontStyle: "italic", textAlign: "center" },
                  ]}
                >
                  {isGenerating
                    ? "Analysis is in progress. Using a local model, it may take some time."
                    : "AI behavioral analysis report has not been calculated for this session. Use the action below to synthesize workstation and biometric insights."}
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
    paddingBottom: 20,
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
    paddingHorizontal: Layout.horizontalPadding,
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
    marginHorizontal: Layout.horizontalPadding,
    backgroundColor: Colors.surface_container,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
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
  heroDivider: {
    width: 1,
    height: 60,
    backgroundColor: Colors.outline_variant,
    marginHorizontal: 16,
  },
  heroSecondary: {
    justifyContent: "center",
    alignItems: "flex-end",
  },
  secondaryInfo: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  secondaryValue: {
    fontSize: 32,
    fontFamily: "InterExtraBold",
    color: Colors.text,
    lineHeight: 32,
    marginTop: 4,
  },
  secondaryUnit: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
  },
  sectionHeader: {
    paddingHorizontal: Layout.horizontalPadding,
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
    marginHorizontal: Layout.horizontalPadding,
    height: 300,
    borderRadius: Layout.borderRadius,
    padding: 5,
    marginBottom: 20,
    backgroundColor: Colors.surface_container,
  },
  chartFooter: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  legendColumn: {
    gap: 4,
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
  chartUnit: {
    fontSize: 9,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
    opacity: 0.5,
  },
  emptyChart: {
    height: 200,
    marginHorizontal: Layout.horizontalPadding,
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
    marginHorizontal: Layout.horizontalPadding,
    backgroundColor: Colors.surface_container,
    padding: 14,
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
    gap: 16,
  },
  narrativeText: {
    fontSize: 14,
    fontFamily: "Inter",
    color: Colors.text,
    lineHeight: 22,
  },
  appLegend: {
    flexDirection: "row",
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.outline_variant,
    paddingTop: 16,
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
  analysisSection: {
    gap: 6,
  },
  analysisLabel: {
    fontSize: 9,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    letterSpacing: 1,
  },
  analysisValue: {
    fontSize: 16,
    fontFamily: "InterBold",
    color: Colors.text,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: Colors.outline_variant,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk",
    color: Colors.text,
  },
  feedbackBox: {
    backgroundColor: "rgba(173, 198, 255, 0.05)",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.tertiary,
  },
  feedbackText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
});
