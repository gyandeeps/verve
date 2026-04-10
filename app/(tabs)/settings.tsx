import { databaseService } from "@/db/DatabaseService";
import { AIEngine, aiFacade } from "@/services/AIFacade";
import { aiService } from "@/services/AIService";
import { healthService } from "@/services/health-service";
import { AISystemStatus, systemAIService } from "@/services/system-ai";
import { GradientButton } from "@/src/components/common/GradientButton";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import * as Updates from "expo-updates";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { AIModel, AVAILABLE_MODELS } from "@/constants/Models";
import { Text, View } from "@/src/components/Themed";
import { DEFAULT_PROMPT_ID, PROMPT_CONFIGS } from "@/src/constants/Prompts";
import { formatDateTime } from "@/src/utils/format";
import { useEffect } from "react";

export default function SettingsScreen() {
  const [count, setCount] = useState(2);
  const [windowMinutes, setWindowMinutes] = useState(15); // default to a smaller window
  const [isInjecting, setIsInjecting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState(DEFAULT_PROMPT_ID);
  const [isDeletingModel, setIsDeletingModel] = useState(false);
  const [preferredEngine, setPreferredEngine] = useState<AIEngine>("local");
  const [isForceSystemAI, setIsForceSystemAI] = useState(false);
  const [systemAIStatus, setSystemAIStatus] = useState<AISystemStatus>(
    AISystemStatus.UNSUPPORTED,
  );
  const [isDownloadingSystem, setIsDownloadingSystem] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const [model, promptId, engine, forced, sysStatus] = await Promise.all([
        aiService.getSelectedModel(),
        aiService.getSelectedPromptId(),
        aiFacade.getPreferredEngine(),
        aiFacade.isForceSystemAI(),
        systemAIService.checkStatus(),
      ]);
      setSelectedModel(model);
      setSelectedPromptId(promptId);
      setPreferredEngine(engine);
      setIsForceSystemAI(forced);
      setSystemAIStatus(sysStatus);
    };
    loadSettings();
  }, []);

  const handleModelChange = async (modelId: string) => {
    try {
      await aiService.setSelectedModel(modelId);
      const model = await aiService.getSelectedModel();
      setSelectedModel(model);
    } catch (err) {
      Alert.alert("Error", "Failed to switch model.");
    }
  };

  const handlePromptChange = async (promptId: string) => {
    try {
      await aiService.setSelectedPromptId(promptId);
      setSelectedPromptId(promptId);
    } catch (err) {
      Alert.alert("Error", "Failed to switch prompt.");
    }
  };

  const toggleEngine = async (engine: AIEngine) => {
    try {
      await aiFacade.setPreferredEngine(engine);
      setPreferredEngine(engine);

      if (
        engine === "system" &&
        systemAIStatus === AISystemStatus.UNSUPPORTED
      ) {
        Alert.alert(
          "Unsupported",
          "Your device hardware does not appear to support on-device AICore/CoreML.",
        );
        // We still allow setting it, but AIFacade will fallback
      }
    } catch (err) {
      Alert.alert("Error", "Failed to update engine preference.");
    }
  };

  const toggleForceSystem = async () => {
    const newValue = !isForceSystemAI;
    try {
      if (newValue && systemAIStatus === AISystemStatus.UNSUPPORTED) {
        Alert.alert(
          "Hardware Warning",
          "You are forcing System AI on a device that reports it is unsupported. This will likely result in inference errors unless drivers are updated.",
        );
      }
      await aiFacade.setForceSystemAI(newValue);
      setIsForceSystemAI(newValue);
    } catch (err) {
      Alert.alert("Error", "Failed to toggle force setting.");
    }
  };

  const handleDownloadSystemModel = async () => {
    setIsDownloadingSystem(true);
    try {
      await systemAIService.downloadModel();
      const status = await systemAIService.checkStatus();
      setSystemAIStatus(status);
      Alert.alert("Success", "System AI Model downloaded successfully.");
    } catch (err) {
      Alert.alert(
        "Download Failed",
        "Ensure your region is set to US and AICore is enabled in system settings.",
      );
    } finally {
      setIsDownloadingSystem(false);
    }
  };

  const isDev = __DEV__;

  const handleClearDatabase = () => {
    Alert.alert(
      "Confirm Reset",
      "This will permanently delete all telemetry, biometric data, and sync anchors from the local SQLite database. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: async () => {
            setIsClearing(true);
            try {
              await databaseService.clearAllTables();
              Alert.alert("Database Purged", "All tables are now empty.");
            } catch (err) {
              Alert.alert("Error", "Failed to clear database.");
            } finally {
              setIsClearing(false);
            }
          },
        },
      ],
    );
  };

  const handleInject = async () => {
    setIsInjecting(true);
    try {
      const { count: injectedTotal, contextTimestamps } =
        await healthService.seedMockData(count, windowMinutes);

      if (injectedTotal === 0) {
        Alert.alert(
          "No Telemetry",
          `No telemetry records found in the last ${windowMinutes} minutes. Mock seeding requires existing workstation events to provide context.`,
        );
        return;
      }

      // Perform an immediate contextual sync so the user sees the data right away.
      const result = await healthService.syncHealthData(contextTimestamps);

      Alert.alert(
        "Demo Data Injected",
        `Generated ${injectedTotal} HR records and synced ${result.storedCount} samples to your local database.`,
      );
    } catch (err) {
      Alert.alert("Error", "Failed to inject demo data. Check permissions.");
    } finally {
      setIsInjecting(false);
    }
  };

  const handleDeleteModel = () => {
    Alert.alert(
      "Confirm Model Deletion",
      `This will remove the local LLM model (${
        selectedModel?.name ?? "AI"
      }, ~${(
        (selectedModel?.sizeBytes || 2500000000) /
        (1024 * 1024 * 1024)
      ).toFixed(
        1,
      )}GB) from your device's storage. You will need to download it again to use offline AI features. Proceed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Yes, Delete ${selectedModel?.name || "Model"}`,
          style: "destructive",
          onPress: async () => {
            setIsDeletingModel(true);
            try {
              await aiService.deleteModel();
              Alert.alert(
                "Model Removed",
                `${selectedModel?.name} has been deleted.`,
              );
            } catch (err) {
              Alert.alert("Error", "Failed to delete the model file.");
            } finally {
              setIsDeletingModel(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {isDev && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Biometric Mocking</Text>
              <SymbolView
                name={{
                  ios: "heart.fill",
                  android: "favorite",
                }}
                size={18}
                tintColor={Colors.secondary}
              />
            </View>

            <View style={styles.optionGroup}>
              <Text style={styles.optionLabel}>
                SAMPLES PER EVENT (DENSITY)
              </Text>
              <View style={styles.buttonSegment}>
                {[1, 2, 3, 10].map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={[
                      styles.segmentButton,
                      count === v && styles.activeSegment,
                    ]}
                    onPress={() => setCount(v)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        count === v && styles.activeText,
                      ]}
                    >
                      {v}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.optionGroup}>
              <Text style={styles.optionLabel}>TIME FRAME (LOOKBACK)</Text>
              <View style={styles.buttonSegment}>
                {[
                  { label: "15m", val: 15 },
                  { label: "30m", val: 30 },
                  { label: "1H", val: 60 },
                  { label: "2H", val: 120 },
                ].map((v) => (
                  <TouchableOpacity
                    key={v.label}
                    style={[
                      styles.segmentButton,
                      windowMinutes === v.val && styles.activeSegment,
                    ]}
                    onPress={() => setWindowMinutes(v.val)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        windowMinutes === v.val && styles.activeText,
                      ]}
                    >
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <GradientButton
              title="Inject Demo Data"
              onPress={handleInject}
              loading={isInjecting}
              style={{ marginTop: 10 }}
            />
          </View>
        )}

        <View style={[styles.section, { marginTop: 20 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: Colors.primary }]}>
              AI Infrastructure Engine
            </Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "AI Architectures",
                  "System AI: Uses native NPU (AICore/CoreML) for maximum efficiency. Zero disk footprint for the app.\n\nLocal LLM: Downloads a standalone GGUF model. Optimized for all hardware but consumes storage.",
                )
              }
            >
              <SymbolView
                name={{ ios: "cpu", android: "memory" }}
                size={18}
                tintColor={Colors.subText}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.optionGroup}>
            <Text style={styles.optionLabel}>PREFERRED COMPUTE ENGINE</Text>
            <View style={styles.buttonSegment}>
              {[
                { label: "System AI", val: "system" as AIEngine },
                { label: "Local LLM", val: "local" as AIEngine },
              ].map((v) => (
                <TouchableOpacity
                  key={v.val}
                  style={[
                    styles.segmentButton,
                    preferredEngine === v.val && styles.activeSegment,
                  ]}
                  onPress={() => toggleEngine(v.val)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      preferredEngine === v.val && styles.activeText,
                    ]}
                  >
                    {v.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.optionGroup}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>FORCE NATIVE HARDWARE</Text>
                <Text
                  style={[
                    styles.description,
                    { marginBottom: 0, marginTop: 4 },
                  ]}
                >
                  Bypasses fallback logic. Requires compatible NPU.
                </Text>
              </View>
              <TouchableOpacity
                onPress={toggleForceSystem}
                style={[
                  styles.toggleSwitch,
                  isForceSystemAI && styles.toggleSwitchActive,
                  { marginTop: 4 },
                ]}
              >
                <View
                  style={[
                    styles.toggleHandle,
                    isForceSystemAI && styles.toggleHandleActive,
                  ]}
                />
              </TouchableOpacity>
            </View>
          </View>

          {preferredEngine === "system" &&
            systemAIStatus === AISystemStatus.DOWNLOADABLE && (
              <GradientButton
                title="Download Native AI Assets"
                onPress={handleDownloadSystemModel}
                loading={isDownloadingSystem}
                style={{ marginTop: 10 }}
              />
            )}

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>HARDWARE STATUS:</Text>
            <Text
              style={[
                styles.statusValue,
                systemAIStatus === AISystemStatus.READY
                  ? { color: Colors.tertiary }
                  : { color: Colors.secondary },
              ]}
            >
              {systemAIStatus.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={[styles.section, { marginTop: 20 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: Colors.tertiary }]}>
              Local LLM (Fallback)
            </Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Local Model Selection",
                  "Used as a fallback when System AI is unavailable. These models are stored locally in the app's document directory.",
                )
              }
            >
              <SymbolView
                name={{ ios: "info.circle", android: "info", web: "info" }}
                size={18}
                tintColor={Colors.subText}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.modelList}>
            {AVAILABLE_MODELS.map((model) => (
              <TouchableOpacity
                key={model.id}
                style={[
                  styles.modelItem,
                  selectedModel?.id === model.id && styles.activeModelItem,
                ]}
                onPress={() => handleModelChange(model.id)}
              >
                <View
                  style={[styles.modelInfo, { backgroundColor: "transparent" }]}
                >
                  <Text
                    style={[
                      styles.modelName,
                      selectedModel?.id === model.id && {
                        color: Colors.tertiary,
                      },
                    ]}
                  >
                    {model.name}
                  </Text>
                  <Text style={styles.modelDesc}>{model.description}</Text>
                </View>
                <Text style={styles.modelSize}>
                  {(model.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, { marginTop: 20 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: Colors.tertiary }]}>
              AI Insight Logic
            </Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Prompt Architecture",
                  "Verve hub uses different system prompts to analyze telemetry. 'Classic' is faster and more stable, 'Temporal' performs deeper trajectory analysis across time epochs.",
                )
              }
            >
              <SymbolView
                name={{ ios: "cpu", android: "memory" }}
                size={18}
                tintColor={Colors.subText}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.promptSelector}>
            {Object.values(PROMPT_CONFIGS).map((config) => (
              <TouchableOpacity
                key={config.id}
                style={[
                  styles.promptTab,
                  selectedPromptId === config.id && styles.activePromptTab,
                ]}
                onPress={() => handlePromptChange(config.id)}
              >
                <View
                  style={[styles.modelInfo, { backgroundColor: "transparent" }]}
                >
                  <Text
                    style={[
                      styles.modelName,
                      selectedPromptId === config.id && {
                        color: Colors.tertiary,
                      },
                    ]}
                  >
                    {config.name}
                  </Text>
                  <Text style={styles.modelDesc}>{config.description}</Text>
                </View>
                {selectedPromptId === config.id && (
                  <SymbolView
                    name={{
                      ios: "checkmark.circle.fill",
                      android: "check_circle",
                    }}
                    size={16}
                    tintColor={Colors.tertiary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, { marginTop: 20 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: Colors.secondary }]}>
              Database Operations
            </Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Database Operations",
                  "Reset all local storage, including history, workstation context, and biometric logs.",
                )
              }
            >
              <SymbolView
                name={{
                  ios: "info.circle",
                  android: "info",
                  web: "info",
                }}
                size={18}
                tintColor={Colors.subText}
              />
            </TouchableOpacity>
          </View>

          <GradientButton
            title="Clear Local Database"
            onPress={handleClearDatabase}
            loading={isClearing}
            variant="danger"
            style={{ marginTop: 10 }}
          />
        </View>

        <View style={[styles.section, { marginTop: 20 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: Colors.secondary }]}>
              AI Model Management
            </Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "AI Model Management",
                  `The local LLM is stored in your documents directory. Deleting it frees up about ${(
                    (selectedModel?.sizeBytes || 2500000000) /
                    (1024 * 1024 * 1024)
                  ).toFixed(1)}GB of space.`,
                )
              }
            >
              <SymbolView
                name={{
                  ios: "info.circle",
                  android: "info",
                  web: "info",
                }}
                size={18}
                tintColor={Colors.subText}
              />
            </TouchableOpacity>
          </View>

          <GradientButton
            title={`Delete ${selectedModel?.name || "Model"}`}
            onPress={handleDeleteModel}
            loading={isDeletingModel}
            variant="danger"
            style={{ marginTop: 10 }}
          />
        </View>

        <View style={[styles.section, { marginTop: 20, marginBottom: 40 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text
              style={[
                styles.sectionTitle,
                { color: Colors.subText, fontSize: 12 },
              ]}
            >
              System Information
            </Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Version Details",
                  `App: ${Constants.expoConfig?.version}\nBuild: ${Constants.nativeBuildVersion}\nChannel: ${Updates.channel}\nUpdate ID: ${Updates.updateId}`,
                )
              }
            >
              <SymbolView
                name={{
                  ios: "info.circle",
                  android: "info",
                  web: "info",
                }}
                size={14}
                tintColor={Colors.subText}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              NATIVE BUILD v{Constants.expoConfig?.version}
            </Text>
            <Text style={styles.infoValue}>
              {Platform.OS.toUpperCase()} {Constants.nativeBuildVersion || "1"}{" "}
              (Released:{" "}
              {Updates.createdAt ? (
                <>Development Build ({formatDateTime(Updates.createdAt)})</>
              ) : (
                "Development Build"
              )}
              )
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>OTA JS UPDATE</Text>
            <Text style={styles.infoValue}>
              {Updates.updateId ? (
                <>
                  {Updates.updateId.substring(0, 7)} (SHA:{" "}
                  {String(
                    Constants.expoConfig?.extra?.gitCommitSha || "Native",
                  ).substring(0, 7)}
                  )
                </>
              ) : (
                "Development Bundle / Local Host"
              )}
            </Text>
          </View>
        </View>
      </ScrollView>

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    gap: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 5,
  },
  title: {
    fontSize: 32,
    fontFamily: "InterExtraBold",
    letterSpacing: -1,
    color: Colors.text,
  },
  header: {
    paddingHorizontal: Layout.horizontalPadding,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  contentContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
    gap: 20,
  },
  section: {
    backgroundColor: Colors.surface_container,
    borderRadius: Layout.borderRadius,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "InterBold",
    color: Colors.primary,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 13,
    fontFamily: "Inter",
    color: Colors.subText,
    lineHeight: 18,
    marginBottom: 24,
  },
  optionGroup: {
    marginBottom: 20,
  },
  optionLabel: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    marginBottom: 10,
    letterSpacing: 1,
  },
  buttonSegment: {
    flexDirection: "row",
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    height: 40,
    borderRadius: Layout.borderRadius,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  activeSegment: {
    borderColor: Colors.tertiary,
    backgroundColor: "rgba(78, 222, 163, 0.1)",
  },
  segmentText: {
    fontSize: 12,
    fontFamily: "InterSemi",
    color: Colors.text,
  },
  activeText: {
    color: Colors.tertiary,
  },
  infoItem: {},
  infoLabel: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    marginBottom: 4,
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "InterSemi",
    color: Colors.text,
    opacity: 0.9,
  },
  modelList: {
    backgroundColor: "transparent",
    gap: 8,
  },
  modelItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: Layout.borderRadius / 2,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
    backgroundColor: "transparent",
    gap: 12,
  },
  activeModelItem: {
    borderColor: Colors.tertiary,
    backgroundColor: "rgba(78, 222, 163, 0.05)",
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    fontSize: 14,
    fontFamily: "InterBold",
    color: Colors.text,
    marginBottom: 2,
  },
  modelDesc: {
    fontSize: 11,
    fontFamily: "Inter",
    color: Colors.subText,
    opacity: 0.7,
  },
  modelSize: {
    fontSize: 12,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
  },
  promptSelector: {
    gap: 8,
  },
  promptTab: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: Layout.borderRadius / 2,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
    backgroundColor: "transparent",
    gap: 12,
  },
  activePromptTab: {
    borderColor: Colors.tertiary,
    backgroundColor: "rgba(78, 222, 163, 0.05)",
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.outline_variant,
    padding: 2,
    justifyContent: "center",
  },
  toggleSwitchActive: {
    backgroundColor: Colors.tertiary,
  },
  toggleHandle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.text,
  },
  toggleHandleActive: {
    alignSelf: "flex-end",
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.outline_variant,
  },
  statusLabel: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    letterSpacing: 1,
  },
  statusValue: {
    fontSize: 10,
    fontFamily: "SpaceGroteskBold",
    letterSpacing: 1,
  },
});
