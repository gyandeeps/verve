import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { AnalysisResultV1 } from "@/services/AIService";
import { Text } from "@/src/components/Themed";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";

interface Props {
  analysis: AnalysisResultV1;
}

export const ClassicInsights: React.FC<Props> = ({ analysis }) => {
  return (
    <>
      <View style={styles.analysisSection}>
        <Text style={styles.analysisLabel}>OVERALL STATE</Text>
        <Text style={[styles.analysisValue, { color: Colors.primary }]}>
          {analysis.overall_state}
        </Text>
      </View>

      {analysis.stress_triggers && analysis.stress_triggers.length > 0 && (
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
      )}

      <View style={styles.analysisSection}>
        <Text style={styles.analysisLabel}>CHURN IMPACT</Text>
        <Text style={styles.narrativeText}>{analysis.churn_impact}</Text>
      </View>

      <LinearGradient
        colors={["rgba(78, 222, 163, 0.08)", "rgba(78, 222, 163, 0.02)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.feedbackBox}
      >
        <Text style={styles.feedbackText}>{analysis.actionable_feedback}</Text>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  analysisSection: {
    gap: 4,
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
  narrativeText: {
    fontSize: 14,
    fontFamily: "Inter",
    color: Colors.text,
    lineHeight: 22,
  },
  feedbackBox: {
    backgroundColor: "rgba(173, 198, 255, 0.05)",
    padding: 12,
    borderRadius: Layout.borderRadius,
    borderLeftWidth: 3,
    borderLeftColor: Colors.tertiary,
  },
  feedbackText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
});
