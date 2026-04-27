import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { AIModel } from "@/constants/Models";
import { AIEngine, aiFacade } from "@/services/AIFacade";
import {
  aiService,
  AIServiceState,
  AnalysisResult,
  TelemetryEvent,
} from "@/services/AIService";
import { insightsService, SessionInsight } from "@/services/InsightsService";
import { healthService } from "@/services/health-service";
import { AISystemStatus, systemAIService } from "@/services/system-ai";
import { Text, View } from "@/src/components/Themed";
import { GradientButton } from "@/src/components/common/GradientButton";
import {
  ShareBriefCard,
  ShareBriefRef,
} from "@/src/components/insights/ShareBriefCard";
import { TemporalInsights } from "@/src/components/insights/TemporalInsights";
import { DEFAULT_PROMPT_ID } from "@/src/constants/Prompts";
import { sharingService } from "@/src/services/SharingService";
import { useFont } from "@shopify/react-native-skia";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from "react-native";
import {
  Area,
  CartesianChart,
  Line,
  useChartTransformState,
} from "victory-native";

const INSIGHT_COMPONENTS: Record<string, React.FC<{ analysis: any }>> = {
  v1: TemporalInsights,
};

export default function InsightsScreen() {
  const [data, setData] = useState<SessionInsight[]>([]);
  const [rawData, setRawData] = useState<SessionInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [focusScore, setFocusScore] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const shareRef = React.useRef<ShareBriefRef>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [aiState, setAiState] = useState(AIServiceState.DISCONNECTED);
  const [modelExists, setModelExists] = useState(false);
  const [avgHr, setAvgHr] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<AIModel | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedPromptId, setSelectedPromptId] = useState(DEFAULT_PROMPT_ID);
  const [activeEngine, setActiveEngine] = useState<AIEngine>("local");
  const [systemStatus, setSystemStatus] = useState<AISystemStatus>(
    AISystemStatus.UNSUPPORTED,
  );
  const [offset, setOffset] = useState(0);
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { state: transformState } = useChartTransformState();
  const font = useFont(require("../../assets/fonts/SpaceMono-Regular.ttf"), 10);

  const domain = React.useMemo(() => {
    if (data.length < 2) return undefined;
    return {
      x: [data[0].start_timestamp, data[data.length - 1].start_timestamp] as [
        number,
        number,
      ],
    };
  }, [data]);

  const PromptComponent = React.useMemo(() => {
    return (
      INSIGHT_COMPONENTS[selectedPromptId] ||
      INSIGHT_COMPONENTS[DEFAULT_PROMPT_ID]
    );
  }, [selectedPromptId]);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setOffset(0);
    setCanLoadMore(true);
    try {
      const { sessions, avgHr, totalCount } =
        await insightsService.getInsightsData(50);

      // We reverse for the chart because victory-native/CartesianChart
      // expects chronological (ASC) data for the X-axis.
      // We add an index for equidistant "tick-based" visualization.
      setData([...sessions].reverse().map((s, i) => ({ ...s, index: i })));
      // Keep a copy of the pre-smoothed raw records for the LLM —
      // it needs sequential, unaveraged data for accurate temporal correlation.
      setRawData(sessions);

      setAvgHr(avgHr);
      setFocusScore(insightsService.calculateFocusScore(sessions));
      setTotalCount(totalCount);
    } catch (error) {
      console.error("Sync [Insight Error]:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMoreData = useCallback(async () => {
    if (isLoadingMore || !canLoadMore) return;

    setIsLoadingMore(true);
    try {
      const nextOffset = offset + 50;
      const { sessions, hasMore } = await insightsService.getInsightsPaginated(
        nextOffset,
        50,
      );

      if (sessions.length > 0) {
        // sessions is newest first (DESC), so we reverse to get ASC for the chart.
        const reversedSessions = [...sessions].reverse();

        setData((prev) => {
          // Recalculate all indices to ensure they are unique and strictly increasing.
          const merged = [...reversedSessions, ...prev];
          return merged.map((s, i) => ({
            ...s,
            index: i,
          }));
        });
        setOffset(nextOffset);
      }

      setCanLoadMore(hasMore);
    } catch (error) {
      console.error("[Insights] Load more error:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [offset, isLoadingMore, canLoadMore]);

  useFocusEffect(
    useCallback(() => {
      const checkModel = async () => {
        const [exists, modelInfo, promptId, engine, sysStatus] =
          await Promise.all([
            aiService.checkModelExists(),
            aiService.getSelectedModel(),
            aiService.getSelectedPromptId(),
            aiFacade.getActiveEngine(),
            systemAIService.checkStatus(),
          ]);

        setModelExists(exists);
        setActiveModel(modelInfo);
        setActiveEngine(engine);
        setSystemStatus(sysStatus);

        setSelectedPromptId((prev) => {
          if (prev !== promptId) {
            setAnalysis(null);
          }
          return promptId;
        });
      };

      checkModel();
      fetchInsights();
    }, [fetchInsights]),
  );

  useEffect(() => {
    // Release the native llama context when this screen unmounts.
    return () => {
      aiService.release();
    };
  }, []);

  const handleDownloadModel = async () => {
    try {
      setAiState(AIServiceState.DOWNLOADING);
      setAiError(null);
      await aiService.downloadModel((p) => setDownloadProgress(p));
      setModelExists(true);
      setAiState(AIServiceState.DISCONNECTED);
    } catch (e: any) {
      setAiState(AIServiceState.ERROR);
      setAiError(e.message || "Model download failed.");
    }
  };

  const handleGenerateAISummary = async () => {
    // If using local engine, we need the model file.
    // If using system engine, we need it to be READY.
    if (activeEngine === "local" && !modelExists) return;
    if (activeEngine === "system" && systemStatus !== AISystemStatus.READY) {
      if (systemStatus === AISystemStatus.DOWNLOADABLE) {
        setAiError(
          "System AI hardware requires assets. Please download in Settings.",
        );
      } else {
        setAiError("System AI hardware is not ready or unsupported.");
      }
      return;
    }

    setIsGenerating(true);
    setAnalysis(null);
    setAiError(null);

    try {
      // Phase 1: Initialize the model context if using local
      if (activeEngine === "local") {
        const currentState = aiService.getState().state;
        if (currentState !== AIServiceState.READY) {
          setAiState(AIServiceState.INITIALIZING);
          await aiService.initialize();
        }
        setAiState(AIServiceState.READY);
      }

      // Phase 2: Run the analysis through the Facade
      const payload: TelemetryEvent[] = insightsService.buildAIPayload(
        rawData,
        20,
      );

      const result = await aiFacade.analyzeCognitiveState(
        payload,
        selectedPromptId,
      );
      setAnalysis(result);
    } catch (e: any) {
      console.error("[Insights] AI Error:", e);
      setAiState(AIServiceState.ERROR);
      setAiError(e.message || "Neural synthesis failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareStatusBrief = async () => {
    if (!analysis || isSharing) return;

    setIsSharing(true);
    try {
      // Capture the base64 from the hidden Skia card
      const base64 = await shareRef.current?.capture();
      if (base64) {
        await sharingService.shareImageBase64(base64);
      } else {
        throw new Error("Failed to capture snapshot from Skia engine.");
      }
    } catch (e: any) {
      console.error("[Insights] Sharing Error:", e);
      setAiError(e.message || "Sharing failed.");
    } finally {
      setIsSharing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Sync any heart rate data that may have been delayed by the OS
      await healthService.syncHealthData();
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
        <Text style={styles.title}>Insights</Text>
        <View style={styles.syncBadge}>
          <View style={styles.syncIndicator} />
          <Text style={styles.syncLabel}>
            BIO-FEEDBACK LOCAL-ONLY • {totalCount} RECORDS IN LAST 24 HRS
          </Text>
        </View>
      </View>

      <LinearGradient
        colors={[Colors.surface_container, Colors.surface_container_lowest]}
        style={styles.heroCard}
      >
        <View style={styles.heroInfo}>
          <Text style={styles.heroLabel}>CURRENT FOCUS INDEX</Text>
          <Text style={styles.heroValue}>
            {focusScore > 0 ? focusScore : "--"}
          </Text>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroSecondary}>
          <View style={styles.secondaryInfo}>
            <Text style={styles.heroLabel}>AVG HEART RATE</Text>
            <View style={styles.secondaryValueContainer}>
              <Text style={styles.secondaryValue}>
                {avgHr > 0 ? avgHr : "--"}
              </Text>
              <Text style={styles.secondaryUnit}>BPM</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Cardiac/Work Correlation</Text>
        <Text style={styles.sectionSubtitle}>
          LAST 24 HRS • BPM & CONTEXT CHURN
        </Text>
      </View>

      {data.length > 2 ? (
        <View style={styles.chartContainer}>
          <CartesianChart
            data={data}
            xKey="start_timestamp"
            domain={domain}
            domainPadding={{ left: 0, right: 0 }}
            yKeys={["avg_bpm", "churn_scaled"]}
            padding={{ bottom: 0, left: 16, right: 16, top: 16 }}
            xAxis={{
              font,
              tickCount: 5,
              labelColor: Colors.subText,
              lineColor: Colors.outline_variant,
              formatXLabel: (v) =>
                new Date(v).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
            }}
            transformState={transformState}
            transformConfig={{
              pan: { dimensions: "x" },
              pinch: { dimensions: "x" },
            }}
            onScaleChange={(rescaledX) => {
              const domain = rescaledX.domain();
              // If we reached the left edge of our loaded data, fetch more
              if (
                data.length > 0 &&
                domain[0] <= data[0].start_timestamp &&
                canLoadMore &&
                !isLoadingMore
              ) {
                loadMoreData();
              }
            }}
            yAxis={[
              {
                font,
                labelColor: Colors.subText,
                lineColor: Colors.outline_variant,
                tickCount: 5,
                formatYLabel: (v) => `${Math.round(v)} bpm`,
                labelOffset: 12,
              },
            ]}
          >
            {({ points }) => (
              <>
                <Area
                  points={points.avg_bpm}
                  y0={0}
                  color="rgba(173, 198, 255, 0.1)"
                  animate={{ type: "timing", duration: 500 }}
                  curveType="natural"
                />
                <Line
                  points={points.avg_bpm}
                  color={Colors.primary}
                  strokeWidth={3}
                  animate={{ type: "timing", duration: 500 }}
                  curveType="natural"
                />
                <Area
                  points={points.churn_scaled}
                  y0={0}
                  color="rgba(78, 222, 163, 0.05)"
                  animate={{ type: "timing", duration: 500 }}
                  curveType="natural"
                />
                <Line
                  points={points.churn_scaled}
                  color={Colors.tertiary}
                  strokeWidth={2}
                  animate={{ type: "timing", duration: 500 }}
                  curveType="natural"
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
                  CONTEXT CHURN (SWITCHES/MIN)
                </Text>
              </View>
            </View>
            <Text style={styles.chartUnit}>SCALED (0-120)</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyText}>
            {totalCount > 0
              ? "INSUFFICIENT SESSION DENSITY"
              : "NO DATA IN LAST 24 HRS"}
          </Text>
          <Text style={styles.emptySubText}>
            {totalCount > 0
              ? `HAVE ${totalCount} RECORD${totalCount === 1 ? "" : "S"}. NEED AT LEAST 3 FOR TEMPORAL CORRELATION.`
              : "NO TELEMETRY RECEIVED FROM THE CLI IN THE PAST 24 HOURS."}
          </Text>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Neural Synapse Insights</Text>
        <Text style={styles.sectionSubtitle}>
          {isGenerating
            ? "NEURAL SYNTHESIS IN PROGRESS..."
            : aiState === AIServiceState.ERROR
              ? "NEURAL SYNTHESIS FAILED"
              : activeEngine === "system"
                ? "HARDWARE-ACCELERATED NATIVE ENGINE (READY)"
                : `LOCAL LLM ENGINE (${activeModel?.name?.toUpperCase() ?? "LOADING..."})`}
        </Text>
      </View>
      <View style={styles.narrativeCard}>
        {activeEngine === "local" && !modelExists ? (
          <View style={styles.modelActionBox}>
            <Text style={styles.modelStatusText}>
              {aiState === AIServiceState.DOWNLOADING
                ? `Downloading Foundation Model (${Math.round(downloadProgress * 100)}%)...`
                : aiState === AIServiceState.ERROR && aiError
                  ? `Error: ${aiError}`
                  : `AI engine is offline. Download the local ${activeModel?.name ?? "LLM"} model to enable high-fidelity narrative synthesis.`}
            </Text>
            {aiState !== AIServiceState.DOWNLOADING && (
              <GradientButton
                title="INITIALIZE LLM ENGINE"
                onPress={handleDownloadModel}
                style={{ marginTop: 10 }}
              />
            )}
          </View>
        ) : (
          <>
            <View style={styles.narrativeContainer}>
              {analysis ? (
                <PromptComponent analysis={analysis as any} />
              ) : (
                <Text
                  style={[
                    styles.narrativeText,
                    { opacity: 0.6, fontStyle: "italic", textAlign: "center" },
                    aiState === AIServiceState.ERROR && {
                      color: Colors.secondary,
                      opacity: 1,
                      fontStyle: "normal",
                    },
                  ]}
                >
                  {isGenerating
                    ? "Analysis is in progress. Using a local model, it may take some time."
                    : aiState === AIServiceState.ERROR && aiError
                      ? `Error: ${aiError}`
                      : "AI behavioral analysis report has not been calculated for this session. Use the action below to synthesize workstation and biometric insights."}
                </Text>
              )}
            </View>

            <View style={styles.actionRow}>
              <GradientButton
                title={isGenerating ? "GENERATING..." : "REFRESH AI NARRATIVE"}
                onPress={handleGenerateAISummary}
                loading={isGenerating}
                style={{ flex: 1 }}
              />
              {analysis && (
                <GradientButton
                  icon={{
                    ios: "square.and.arrow.up",
                    android: "share",
                    web: "share",
                  }}
                  onPress={handleShareStatusBrief}
                  loading={isSharing}
                  variant="ghost"
                  style={styles.shareButton}
                />
              )}
            </View>
          </>
        )}
      </View>

      {/* Hidden Skia export card */}
      {analysis && (
        <ShareBriefCard
          ref={shareRef}
          analysis={analysis}
          focusScore={focusScore}
          avgHr={avgHr}
        />
      )}
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
    fontSize: 48,
    fontFamily: "InterExtraBold",
    color: Colors.text,
  },
  heroDivider: {
    width: 1,
    height: 60,
    backgroundColor: Colors.outline_variant,
    marginHorizontal: 16,
  },
  heroSecondary: {
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryInfo: {
    alignItems: "center",
    marginBottom: 8,
  },
  secondaryValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secondaryValue: {
    fontSize: 32,
    fontFamily: "InterExtraBold",
    color: Colors.text,
  },
  secondaryUnit: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
    marginBottom: 2,
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
    marginBottom: 20,
    backgroundColor: Colors.surface_container,
  },
  chartFooter: {
    paddingHorizontal: 16,
    paddingBottom: 10,
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
  modelActionBox: {
    paddingVertical: 8,
    gap: 8,
  },
  modelStatusText: {
    fontSize: 13,
    fontFamily: "Inter",
    color: Colors.subText,
    lineHeight: 20,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  shareButton: {
    paddingHorizontal: 16, // Smaller horizontal padding for the icon-only button
  },
});
