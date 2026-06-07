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
import { InsightsLoadingSkeleton } from "@/src/components/common/InsightsLoadingSkeleton";
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
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { LineGraph } from "react-native-graph";
import { SymbolView } from "expo-symbols";
import Animated, { FadeInDown } from "react-native-reanimated";

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
  const scrollRef = React.useRef<ScrollView>(null);
  const isInitialLoadRef = React.useRef(true);

  // Interactive Scrubbing state
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<SessionInsight | null>(
    null,
  );

  const getDominantApp = (sessions?: any[]) => {
    if (!sessions || sessions.length === 0) return "Unknown";
    return sessions.reduce((prev, current) =>
      prev.duration_sec > current.duration_sec ? prev : current,
    ).app;
  };

  const handlePointSelected = (point: any) => {
    const match = data.find(
      (d) => new Date(d.start_timestamp).getTime() === point.date.getTime(),
    );
    if (match) {
      setSelectedPoint(match);
    }
  };
  const [systemStatus, setSystemStatus] = useState<AISystemStatus>(
    AISystemStatus.UNSUPPORTED,
  );
  const font = useFont(require("../../assets/fonts/SpaceMono-Regular.ttf"), 10);

  const { bpmPoints, churnPoints } = React.useMemo(() => {
    return {
      bpmPoints: data.map((d) => ({
        date: new Date(d.start_timestamp),
        value: d.avg_bpm || 0,
      })),
      churnPoints: data.map((d) => ({
        date: new Date(d.start_timestamp),
        value: d.churn_scaled || 0,
      })),
    };
  }, [data]);

  const PromptComponent = React.useMemo(() => {
    return (
      INSIGHT_COMPONENTS[selectedPromptId] ||
      INSIGHT_COMPONENTS[DEFAULT_PROMPT_ID]
    );
  }, [selectedPromptId]);

  const fetchInsights = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const { sessions, avgHr, totalCount } =
        await insightsService.getInsightsData();

      // We reverse for the chart because react-native-graph
      // expects chronological (ASC) data for the X-axis.
      // We add an index for equidistant "tick-based" visualization.
      setData([...sessions].reverse().map((s, i) => ({ ...s, index: i })));
      // Keep a copy of the pre-smoothed raw records for the LLM —
      // it needs sequential, unaveraged data for accurate temporal correlation.
      setRawData(sessions);

      setAvgHr(avgHr);
      setFocusScore(insightsService.calculateFocusScore(sessions));
      setTotalCount(totalCount);
      // Scroll to the end after data loads to show most recent data
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("Sync [Insight Error]:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
      fetchInsights(!isInitialLoadRef.current);
      isInitialLoadRef.current = false;
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
        30,
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
    fetchInsights(true);
  };

  if ((loading || !font) && !refreshing) {
    return <InsightsLoadingSkeleton />;
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
      <Animated.View
        entering={FadeInDown.springify().damping(15).stiffness(100).delay(100)}
        style={styles.header}
      >
        <Text style={styles.title}>Insights</Text>
        <View style={styles.syncBadge}>
          <View style={styles.syncIndicator} />
          <Text style={styles.syncLabel}>
            BIO-FEEDBACK LOCAL-ONLY • {totalCount} RECORDS IN LAST 24 HRS
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.springify().damping(15).stiffness(100).delay(200)}
      >
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
      </Animated.View>

      <Animated.View
        entering={FadeInDown.springify().damping(15).stiffness(100).delay(300)}
      >
        <View style={styles.chartHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Cardiac/Work Correlation</Text>
            <Text style={styles.sectionSubtitle}>
              LAST 24 HRS • BPM & CONTEXT CHURN
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setIsInteractiveMode((prev) => !prev);
              setIsScrubbing(false);
              setSelectedPoint(null);
            }}
            style={[
              styles.consoleToggleBadge,
              isInteractiveMode && styles.consoleToggleBadgeActive,
            ]}
          >
            <SymbolView
              name={{
                ios: "hand.tap.fill",
                android: "gesture",
                web: "gesture",
              }}
              tintColor={isInteractiveMode ? Colors.primary : Colors.subText}
              size={12}
            />
            <Text
              style={[
                styles.consoleToggleText,
                isInteractiveMode && { color: Colors.primary },
              ]}
            >
              {isInteractiveMode ? "INTERACTIVE" : "TIMELINE"}
            </Text>
          </TouchableOpacity>
        </View>

        {data.length > 2 ? (
          <View style={styles.chartContainer}>
            {isScrubbing && selectedPoint && (
              <View style={styles.glassTooltip}>
                <View style={styles.tooltipRow}>
                  <Text style={styles.tooltipTime}>
                    {new Date(selectedPoint.start_timestamp).toLocaleTimeString(
                      [],
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                      },
                    )}
                  </Text>
                  <Text style={styles.tooltipApp} numberOfLines={1}>
                    {getDominantApp(selectedPoint.sessions_data)}
                  </Text>
                </View>
                <View style={styles.tooltipMetrics}>
                  <View style={styles.tooltipMetricItem}>
                    <View
                      style={[
                        styles.tooltipDot,
                        { backgroundColor: Colors.primary },
                      ]}
                    />
                    <Text style={styles.tooltipMetricLabel}>
                      HR:{" "}
                      <Text style={styles.tooltipMetricValue}>
                        {selectedPoint.avg_bpm || "--"} BPM
                      </Text>
                    </Text>
                  </View>
                  <View style={styles.tooltipMetricItem}>
                    <View
                      style={[
                        styles.tooltipDot,
                        { backgroundColor: Colors.tertiary },
                      ]}
                    />
                    <Text style={styles.tooltipMetricLabel}>
                      CHURN:{" "}
                      <Text style={styles.tooltipMetricValue}>
                        {selectedPoint.churn_rate.toFixed(1)}/M
                      </Text>
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.chartBody}>
              {/* Y-Axis Labels */}
              <View style={styles.yAxis}>
                {[120, 90, 60, 30, 0].map((label) => (
                  <Text key={label} style={styles.axisLabel}>
                    {label}
                  </Text>
                ))}
              </View>

              {isInteractiveMode ? (
                <View style={{ flex: 1 }}>
                  <View style={[styles.graphWrapper, { marginLeft: 8 }]}>
                    {/* Churn Graph (Background) */}
                    <LineGraph
                      points={churnPoints}
                      animated={true}
                      color={Colors.tertiary}
                      lineThickness={2}
                      range={{ y: { min: 0, max: 120 } }}
                      style={StyleSheet.absoluteFill}
                    />
                    {/* BPM Graph (Foreground) */}
                    <LineGraph
                      points={bpmPoints}
                      animated={true}
                      color={Colors.primary}
                      lineThickness={3}
                      range={{ y: { min: 0, max: 120 } }}
                      style={StyleSheet.absoluteFill}
                      enablePanGesture={true}
                      onGestureStart={() => setIsScrubbing(true)}
                      onGestureEnd={() => {
                        setIsScrubbing(false);
                        setSelectedPoint(null);
                      }}
                      onPointSelected={handlePointSelected}
                    />

                    {/* Dynamic Scrub Cursor Line */}
                    {isScrubbing && selectedPoint && (
                      <View
                        style={[
                          styles.scrubCursor,
                          {
                            left: `${
                              ((selectedPoint.index ?? 0) / (data.length - 1)) *
                              100
                            }%`,
                          },
                        ]}
                      />
                    )}
                  </View>

                  {/* Custom Axes for Interactive Fixed View */}
                  <View
                    style={[styles.xAxis, { marginTop: 12, marginLeft: 8 }]}
                  >
                    {data.length >= 2 &&
                      [0, 1, 2, 3, 4].map((i) => {
                        const index = Math.floor((i / 4) * (data.length - 1));
                        const point = data[index];
                        return (
                          <Text key={i} style={styles.axisLabel}>
                            {new Date(point.start_timestamp).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </Text>
                        );
                      })}
                  </View>
                </View>
              ) : (
                <ScrollView
                  ref={scrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingRight: 16,
                  }}
                  onScroll={({ nativeEvent }) => {
                    // No load-more logic, just horizontal panning
                  }}
                  scrollEventThrottle={16}
                >
                  <View
                    style={{
                      width: Math.max(
                        Dimensions.get("window").width,
                        data.length * 8,
                      ),
                    }}
                  >
                    <View style={styles.graphWrapper}>
                      {/* Churn Graph (Background) */}
                      <LineGraph
                        points={churnPoints}
                        animated={true}
                        color={Colors.tertiary}
                        lineThickness={2}
                        range={{ y: { min: 0, max: 120 } }}
                        style={StyleSheet.absoluteFill}
                      />
                      {/* BPM Graph (Foreground) */}
                      <LineGraph
                        points={bpmPoints}
                        animated={true}
                        color={Colors.primary}
                        lineThickness={3}
                        range={{ y: { min: 0, max: 120 } }}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>

                    {/* Custom Axes for Clinical Console Aesthetic */}
                    <View style={styles.xAxis}>
                      {data.length >= 2 &&
                        [0, 1, 2, 3, 4].map((i) => {
                          const index = Math.floor((i / 4) * (data.length - 1));
                          const point = data[index];
                          return (
                            <Text key={i} style={styles.axisLabel}>
                              {new Date(
                                point.start_timestamp,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </Text>
                          );
                        })}
                    </View>
                  </View>
                </ScrollView>
              )}
            </View>

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
      </Animated.View>

      <Animated.View
        entering={FadeInDown.springify().damping(15).stiffness(100).delay(400)}
      >
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
                      {
                        opacity: 0.6,
                        fontStyle: "italic",
                        textAlign: "center",
                      },
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
                  title={
                    isGenerating ? "GENERATING..." : "REFRESH AI NARRATIVE"
                  }
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
      </Animated.View>

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
    gap: 20,
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
    borderRadius: Layout.borderRadius,
    marginBottom: 20,
    backgroundColor: Colors.surface_container,
    paddingVertical: 20,
  },
  chartBody: {
    flexDirection: "row",
    height: 220,
    paddingHorizontal: 16,
  },
  yAxis: {
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: 8,
    height: "100%",
  },
  graphWrapper: {
    flex: 1,
  },
  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 8,
  },
  axisLabel: {
    fontSize: 9,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
    textTransform: "uppercase",
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
  chartHeaderRow: {
    paddingHorizontal: Layout.horizontalPadding,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  consoleToggleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface_container,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
    gap: 6,
  },
  consoleToggleBadgeActive: {
    borderColor: "rgba(173, 198, 255, 0.4)",
  },
  consoleToggleText: {
    fontSize: 9,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    letterSpacing: 0.5,
  },
  scrubCursor: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: Colors.primary,
    opacity: 0.5,
  },
  glassTooltip: {
    position: "absolute",
    top: 10,
    left: 16,
    right: 16,
    backgroundColor: "rgba(23, 31, 51, 0.92)",
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(173, 198, 255, 0.15)",
    zIndex: 100,
    gap: 6,
  },
  tooltipRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  tooltipTime: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    color: Colors.primary,
  },
  tooltipApp: {
    fontSize: 11,
    fontFamily: "InterBold",
    color: Colors.text,
    maxWidth: 150,
  },
  tooltipMetrics: {
    flexDirection: "row",
    gap: 16,
  },
  tooltipMetricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tooltipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tooltipMetricLabel: {
    fontSize: 10,
    fontFamily: "SpaceGrotesk",
    color: Colors.subText,
  },
  tooltipMetricValue: {
    color: Colors.text,
    fontFamily: "SpaceGroteskBold",
  },
});
