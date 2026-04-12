import Colors from "@/constants/Colors";
import { AnalysisResult } from "@/services/AIService";
import { formatDateTime } from "@/src/utils/format";
import {
  Canvas,
  Circle,
  LinearGradient,
  Rect,
  Text as SkiaText,
  useCanvasRef,
  useFont,
  vec,
} from "@shopify/react-native-skia";
import React, { forwardRef, useImperativeHandle } from "react";
import { StyleSheet, View } from "react-native";

// Size of the square share card
const SIZE = 1080;
const PADDING = 80;

interface ShareBriefCardProps {
  analysis: AnalysisResult;
  focusScore: number;
  avgHr: number;
}

export interface ShareBriefRef {
  capture: () => Promise<string | null>;
}

// Helper to wrap text for Skia
const wrapText = (text: string, font: any, maxWidth: number) => {
  if (!font || !text) return [];
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = font.getTextWidth(currentLine + " " + word);
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
};

export const ShareBriefCard = forwardRef<ShareBriefRef, ShareBriefCardProps>(
  ({ analysis, focusScore, avgHr }, ref) => {
    const canvasRef = useCanvasRef();

    const fontDisplay = useFont(
      require("../../../assets/fonts/SpaceMono-Regular.ttf"),
      280,
    );
    const fontHeader = useFont(
      require("../../../assets/fonts/SpaceMono-Regular.ttf"),
      42,
    );
    const fontLabel = useFont(
      require("../../../assets/fonts/SpaceMono-Regular.ttf"),
      24,
    );
    const fontStatus = useFont(
      require("../../../assets/fonts/SpaceMono-Regular.ttf"),
      32,
    );
    const fontMeta = useFont(
      require("../../../assets/fonts/SpaceMono-Regular.ttf"),
      18,
    );

    useImperativeHandle(ref, () => ({
      capture: async () => {
        const image = canvasRef.current?.makeImageSnapshot();
        if (image) {
          return image.encodeToBase64();
        }
        return null;
      },
    }));

    if (!fontDisplay || !fontHeader || !fontLabel || !fontStatus || !fontMeta) {
      return null;
    }

    const timestamp = formatDateTime(Date.now());
    const primaryState = analysis.primary_state || "DEEP_WORK";
    const synthesisText =
      analysis.at_a_glance || analysis.micro_action || "CONTINUE_FLOW";
    const topApps = analysis.top_contributors
      ?.map((c) => c.app_name.toUpperCase())
      .slice(0, 3)
      .join(", ");

    // Layout Constants
    const headerY = PADDING + 40;
    const scoreY = PADDING + 320;
    const metricsY = PADDING + 460;
    const appsY = PADDING + 580;
    const synthesisBoxY = PADDING + 680;

    return (
      <View style={styles.container}>
        <Canvas ref={canvasRef} style={styles.canvas}>
          {/* Background */}
          <Rect
            x={0}
            y={0}
            width={SIZE}
            height={SIZE}
            color={Colors.background}
          />

          {/* Background Depth Gradient */}
          <Rect x={0} y={0} width={SIZE} height={SIZE}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(SIZE, SIZE)}
              colors={["#000000", Colors.background, "#000000"]}
            />
          </Rect>

          {/* Subtle Grid Lines */}
          {[...Array(40)].map((_, i) => (
            <Rect
              key={`h-${i}`}
              x={0}
              y={(SIZE / 40) * i}
              width={SIZE}
              height={1}
              color={Colors.primary}
              opacity={0.03}
            />
          ))}
          {[...Array(40)].map((_, i) => (
            <Rect
              key={`v-${i}`}
              x={(SIZE / 40) * i}
              y={0}
              width={1}
              height={SIZE}
              color={Colors.primary}
              opacity={0.03}
            />
          ))}

          {/* Outer Border */}
          <Rect
            x={20}
            y={20}
            width={SIZE - 40}
            height={SIZE - 40}
            color={Colors.primary}
            style="stroke"
            strokeWidth={1}
            opacity={0.2}
          />

          {/* Header */}
          <SkiaText
            x={PADDING}
            y={headerY}
            text="VERVE // STATUS_REPORT"
            font={fontHeader}
            color={Colors.primary}
          />
          <Rect
            x={PADDING}
            y={headerY + 20}
            width={400}
            height={2}
            color={Colors.primary}
          />
          <SkiaText
            x={SIZE - PADDING - 240}
            y={headerY}
            text={`[ ${timestamp} ]`}
            font={fontMeta}
            color={Colors.subText}
          />

          {/* Large Score */}
          <SkiaText
            x={SIZE / 2 - fontDisplay.getTextWidth(focusScore.toString()) / 2}
            y={scoreY}
            text={focusScore.toString()}
            font={fontDisplay}
            color={Colors.text}
          />
          <SkiaText
            x={SIZE / 2 - fontMeta.getTextWidth("FOCUS_INDEX") / 2}
            y={scoreY + 40}
            text="FOCUS_INDEX"
            font={fontMeta}
            color={Colors.primary}
            opacity={0.6}
          />

          {/* Primary Metrics */}
          <SkiaText
            x={PADDING}
            y={metricsY}
            text={`PRIMARY_NEURAL_STATE: ${primaryState
              .toString()
              .toUpperCase()}`}
            font={fontStatus}
            color={Colors.text}
          />
          <SkiaText
            x={PADDING}
            y={metricsY + 45}
            text={`AVERAGE_HEART_RATE: ${avgHr} BPM`}
            font={fontStatus}
            color={Colors.text}
          />

          {/* Top Instruments (Apps) */}
          {topApps && (
            <SkiaText
              x={PADDING}
              y={appsY}
              text={`PRIMARY_INSTRUMENTS: ${topApps}`}
              font={fontStatus}
              color={Colors.tertiary}
            />
          )}

          {/* Synthesis Section */}
          <Rect
            x={PADDING}
            y={synthesisBoxY}
            width={SIZE - PADDING * 2}
            height={260}
            color={Colors.surface_container}
            opacity={0.2}
          />
          <Rect
            x={PADDING}
            y={synthesisBoxY}
            width={SIZE - PADDING * 2}
            height={260}
            color={Colors.primary}
            style="stroke"
            strokeWidth={1}
            opacity={0.4}
          />
          <Rect
            x={PADDING}
            y={synthesisBoxY}
            width={SIZE - PADDING * 2}
            height={40}
            color={Colors.surface_container}
          />
          <SkiaText
            x={PADDING + 20}
            y={synthesisBoxY + 30}
            text="SYNTHESIS"
            font={fontMeta}
            color={Colors.subText}
          />

          {wrapText(synthesisText, fontLabel, SIZE - PADDING * 2 - 40).map(
            (line, i) => (
              <SkiaText
                key={i}
                x={PADDING + 20}
                y={synthesisBoxY + 85 + i * 35}
                text={line}
                font={fontLabel}
                color={Colors.text}
              />
            ),
          )}

          {/* Footer / Badge */}
          <Circle
            cx={SIZE - PADDING - 260}
            cy={SIZE - PADDING + 20}
            r={8}
            color={Colors.tertiary}
          />
          <SkiaText
            x={SIZE - PADDING - 240}
            y={SIZE - PADDING + 28}
            text="LOCAL_SYNC_VERIFIED"
            font={fontMeta}
            color={Colors.tertiary}
          />
        </Canvas>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: -SIZE * 2,
    top: -SIZE * 2,
  },
  canvas: {
    width: SIZE,
    height: SIZE,
  },
});
