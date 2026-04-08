import Colors from "@/constants/Colors";
import { AnalysisResultV2 } from "@/services/AIService";
import { Text } from "@/src/components/Themed";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";
import Layout from "@/constants/Layout";

interface Props {
  analysis: AnalysisResultV2;
}

export const TemporalInsights: React.FC<Props> = ({ analysis }) => {
  return (
    <>
      <View style={styles.analysisSection}>
        <Text style={styles.analysisLabel}>TRAJECTORY</Text>
        <Text style={[styles.analysisValue, { color: Colors.primary }]}>
          {analysis.trajectory} • {analysis.primary_state}
        </Text>
      </View>

      <View style={styles.analysisSection}>
        <Text style={styles.analysisLabel}>COGNITIVE LOAD INDEX</Text>
        <View style={styles.loadBarContainer}>
          <LinearGradient
            colors={[Colors.primary, Colors.primary_container]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.loadBarFill,
              { width: `${analysis.current_load_index}%` },
            ]}
          />
        </View>
        <Text style={styles.loadBarText}>
          {analysis.current_load_index}/100
        </Text>
      </View>

      <LinearGradient
        colors={["rgba(78, 222, 163, 0.08)", "rgba(78, 222, 163, 0.02)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.feedbackBox, styles.atAGlanceBox]}
      >
        <Text style={styles.atAGlanceText}>{analysis.at_a_glance}</Text>
      </LinearGradient>

      {analysis.top_contributors && analysis.top_contributors.length > 0 && (
        <View style={styles.analysisSection}>
          <Text style={styles.analysisLabel}>TOP CONTRIBUTORS (Δ BPM)</Text>
          <View style={styles.chipContainer}>
            {analysis.top_contributors.map((item, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>
                  {item.app_name} ({item.hr_delta > 0 ? "+" : ""}
                  {item.hr_delta})
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <LinearGradient
        colors={["rgba(173, 198, 255, 0.08)", "rgba(173, 198, 255, 0.02)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.feedbackBox, styles.directiveBox]}
      >
        <Text style={styles.directiveLabel}>DIRECTIVE:</Text>
        <Text style={styles.directiveText}>{analysis.micro_action}</Text>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  analysisSection: {
    gap: 6,
  },
  analysisLabel: {
    fontSize: 9,
    fontFamily: "SpaceGroteskBold",
    color: Colors.subText,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  analysisValue: {
    fontSize: 16,
    fontFamily: "InterBold",
    color: Colors.text,
  },
  loadBarContainer: {
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 4,
  },
  loadBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
  },
  loadBarText: {
    fontSize: 9,
    fontFamily: "SpaceMono",
    color: Colors.subText,
    marginTop: 4,
    textAlign: "right",
  },
  feedbackBox: {
    padding: 12,
    borderRadius: Layout.borderRadius,
    marginVertical: 4,
  },
  atAGlanceBox: {
    backgroundColor: "rgba(173, 198, 255, 0.05)",
    borderLeftWidth: 3,
    borderLeftColor: Colors.tertiary,
    marginBottom: 8,
  },
  atAGlanceText: {
    fontSize: 14,
    fontFamily: "InterBold",
    color: Colors.text,
    lineHeight: 20,
    fontStyle: "italic",
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
  directiveBox: {
    backgroundColor: "rgba(173, 198, 255, 0.05)",
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    gap: 4,
  },
  directiveLabel: {
    fontFamily: "SpaceGroteskBold",
    textTransform: "uppercase",
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 1,
  },
  directiveText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
    fontFamily: "InterSemi",
  },
});
