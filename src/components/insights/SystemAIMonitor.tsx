import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useSystemAI } from "../../hooks/useSystemAI";
import { AISystemStatus } from "../../services/system-ai";

/**
 * System-First AI Monitor Component
 * Displays the current status of the on-device NPU/AICore and allows manual download.
 */
export const SystemAIMonitor = () => {
  const { status, isProcessing, isModelPresent, downloadModel, executePrompt } =
    useSystemAI();
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const handleTestInference = async () => {
    try {
      const response = await executePrompt(
        "Analyze user focus: No context switches in 10 minutes, HR stable at 62 BPM.",
      );
      setLastResponse(response);
    } catch (e) {
      setLastResponse("Error: Local model failed to respond.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>SYSTEM AI ENGINE</Text>
        <View
          style={[
            styles.badge,
            status === AISystemStatus.READY
              ? styles.badgeReady
              : styles.badgeNotReady,
          ]}
        >
          <Text style={styles.badgeText}>{status.toUpperCase()}</Text>
        </View>
      </View>

      <Text style={styles.description}>
        {status === AISystemStatus.READY
          ? "Hardware NPU/AICore is active. All inference is 100% on-device."
          : status === AISystemStatus.ERROR
            ? "Hardware Error: Ensure the device supports on-device AI and models are fully downloaded in System Settings (Region: US)."
            : "Local AI hardware models are available but not initialized."}
      </Text>

      <View style={styles.actionContainer}>
        {status === AISystemStatus.DOWNLOADABLE && (
          <TouchableOpacity style={styles.button} onPress={downloadModel}>
            <Text style={styles.buttonText}>DOWNLOAD LOCAL MODEL</Text>
          </TouchableOpacity>
        )}

        {status === AISystemStatus.READY && (
          <TouchableOpacity
            style={styles.buttonPrimary}
            onPress={handleTestInference}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonTextPrimary}>TEST LOCAL INFERENCE</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {lastResponse && (
        <View style={styles.responseContainer}>
          <Text style={styles.responseLabel}>NATIVE ANALYST RESPONSE:</Text>
          <Text style={styles.responseText}>{lastResponse}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          PHASE 2: PRIVATE-CORE ARCHITECTURE
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#12141C",
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#232632",
    marginVertical: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    color: "#E0E0E0",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.5,
    fontFamily: "SpaceMono", // Assuming Monospace for Clinical Console
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeReady: {
    backgroundColor: "#10B98122",
    borderColor: "#10B981",
    borderWidth: 1,
  },
  badgeNotReady: {
    backgroundColor: "#F59E0B22",
    borderColor: "#F59E0B",
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#E0E0E0",
  },
  description: {
    color: "#9CA3AF",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
  },
  actionContainer: {
    gap: 10,
  },
  button: {
    borderWidth: 1,
    borderColor: "#374151",
    padding: 12,
    alignItems: "center",
    borderRadius: 4,
  },
  buttonPrimary: {
    backgroundColor: "#3B82F6",
    padding: 12,
    alignItems: "center",
    borderRadius: 4,
  },
  buttonText: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "600",
  },
  buttonTextPrimary: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800",
  },
  responseContainer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#000",
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: "#3B82F6",
  },
  responseLabel: {
    color: "#3B82F6",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 8,
  },
  responseText: {
    color: "#60A5FA",
    fontSize: 12,
    fontFamily: "SpaceMono",
  },
  footer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#1F2937",
    alignItems: "center",
  },
  footerText: {
    color: "#4B5563",
    fontSize: 9,
    letterSpacing: 1,
  },
});
