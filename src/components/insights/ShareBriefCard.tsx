import React, { forwardRef, useImperativeHandle } from "react";
import {
  Canvas,
  useCanvasRef,
  Skia,
  Text as SkiaText,
  useFont,
  Rect,
  LinearGradient,
  vec,
  Circle,
  Path,
} from "@shopify/react-native-skia";
import { View, StyleSheet } from "react-native";
import Colors from "@/constants/Colors";
import { AnalysisResult } from "@/services/AIService";
import { formatDateTime } from "@/src/utils/format";

// Size of the square share card
const SIZE = 1080;
const PADDING = 80;

interface ShareBriefCardProps {
  analysis: AnalysisResult;
  focusScore: number;
  avgHr: number;
  recentData: any[]; // Last few session segments
}

export interface ShareBriefRef {
  capture: () => Promise<string | null>;
}

export const ShareBriefCard = forwardRef<ShareBriefRef, ShareBriefCardProps>(
  ({ analysis, focusScore, avgHr, recentData }, ref) => {
    const canvasRef = useCanvasRef();

    // Load available fonts
    // Since only SpaceMono-Regular is in assets/fonts right now, we use different sizes for hierarchy
    const fontDisplay = useFont(
      require("../../../assets/fonts/SpaceMono-Regular.ttf"),
      140,
    );
    const fontHeader = useFont(
      require("../../../assets/fonts/SpaceMono-Regular.ttf"),
      32,
    );
    const fontLabel = useFont(
      require("../../../assets/fonts/SpaceMono-Regular.ttf"),
      18,
    );
    const fontStatus = useFont(
      require("../../../assets/fonts/SpaceMono-Regular.ttf"),
      24,
    );
    const fontMeta = useFont(
      require("../../../assets/fonts/SpaceMono-Regular.ttf"),
      14,
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

    // Process sparkline path
    const sparklineWidth = SIZE - PADDING * 2;
    const sparklineHeight = 120;
    const generateSparkline = () => {
      const path = Skia.Path.Make();
      if (!recentData || recentData.length < 2) return path;

      const bpms = recentData
        .filter((p) => p.avg_bpm > 0)
        .map((p) => p.avg_bpm);
      if (bpms.length < 2) return path;

      const minBpm = Math.min(...bpms);
      const maxBpm = Math.max(...bpms);
      const spread = maxBpm - minBpm || 20;

      recentData.forEach((p, i) => {
        const x = PADDING + (i / (recentData.length - 1)) * sparklineWidth;
        const normalizedY = p.avg_bpm > 0 ? (p.avg_bpm - minBpm) / spread : 0.5;
        const y = SIZE - PADDING - 40 - normalizedY * sparklineHeight;

        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
      return path;
    };

    const sparklinePath = generateSparkline();
    const timestamp = formatDateTime(Date.now());

    // Extract V2 specific analysis if available
    const primaryState =
      (analysis as any).primary_state || analysis.overall_state || "DEEP_WORK";
    const directive =
      (analysis as any).micro_action ||
      analysis.actionable_feedback ||
      "CONTINUE_FLOW";

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

          {/* Subtle Grid / Texture Layer */}
          <Rect x={0} y={0} width={SIZE} height={SIZE} opacity={0.03}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(SIZE, SIZE)}
              colors={[Colors.primary, "transparent", Colors.tertiary]}
            />
          </Rect>

          {/* Header */}
          <SkiaText
            x={PADDING}
            y={PADDING + 40}
            text="VERVE // STATUS_REPORT"
            font={fontHeader}
            color={Colors.primary}
          />
          <SkiaText
            x={SIZE - PADDING - 240}
            y={PADDING + 40}
            text={`[ ${timestamp} ]`}
            font={fontMeta}
            color={Colors.subText}
          />

          {/* Focus Index Large Display */}
          <SkiaText
            x={PADDING}
            y={PADDING + 140}
            text="CURRENT_FOCUS_INDEX"
            font={fontMeta}
            color={Colors.subText}
          />
          <SkiaText
            x={PADDING - 10}
            y={PADDING + 300}
            text={focusScore.toString()}
            font={fontDisplay}
            color={Colors.text}
          />

          {/* Primary State Section */}
          <Rect
            x={PADDING}
            y={PADDING + 380}
            width={SIZE - PADDING * 2}
            height={100}
            color={Colors.surface_container}
          />
          <SkiaText
            x={PADDING + 20}
            y={PADDING + 415}
            text="PRIMARY_NEURAL_STATE"
            font={fontMeta}
            color={Colors.subText}
          />
          <SkiaText
            x={PADDING + 20}
            y={PADDING + 455}
            text={primaryState.toString().toUpperCase().replace(/ /g, "_")}
            font={fontStatus}
            color={Colors.primary}
          />

          {/* Secondary Stats Group */}
          {/* Avg BPM Box */}
          <Rect
            x={PADDING}
            y={PADDING + 520}
            width={(SIZE - PADDING * 2 - 40) / 2}
            height={160}
            color={Colors.surface_container}
          />
          <SkiaText
            x={PADDING + 20}
            y={PADDING + 555}
            text="AVERAGE_HEART_RATE"
            font={fontMeta}
            color={Colors.subText}
          />
          <SkiaText
            x={PADDING + 20}
            y={PADDING + 625}
            text={`${avgHr} BPM`}
            font={fontStatus}
            color={Colors.text}
          />

          {/* Directive Box */}
          <Rect
            x={PADDING + (SIZE - PADDING * 2 - 40) / 2 + 40}
            y={PADDING + 520}
            width={(SIZE - PADDING * 2 - 40) / 2}
            height={160}
            color={Colors.surface_container}
          />
          <SkiaText
            x={PADDING + (SIZE - PADDING * 2 - 40) / 2 + 60}
            y={PADDING + 555}
            text="DIRECTIVE"
            font={fontMeta}
            color={Colors.subText}
          />
          <SkiaText
            x={PADDING + (SIZE - PADDING * 2 - 40) / 2 + 60}
            y={PADDING + 625}
            text={directive.toString().split(" ")[0].toUpperCase()}
            font={fontStatus}
            color={Colors.tertiary}
          />

          {/* Narrative Summary area */}
          <SkiaText
            x={PADDING}
            y={PADDING + 760}
            text="SYNTHESIS"
            font={fontMeta}
            color={Colors.subText}
          />
          <SkiaText
            x={PADDING}
            y={PADDING + 810}
            text={directive.toString()}
            font={fontLabel}
            color={Colors.text}
          />

          {/* BPM Trend Visualization */}
          <SkiaText
            x={PADDING}
            y={SIZE - PADDING - 180}
            text="60M_CARDIAC_TRENDLINE"
            font={fontMeta}
            color={Colors.subText}
          />
          <Path
            path={sparklinePath}
            color={Colors.primary}
            style="stroke"
            strokeWidth={4}
            strokeJoin="round"
            strokeCap="round"
          />

          {/* Verify Badge */}
          <Circle
            cx={PADDING + 10}
            cy={SIZE - PADDING + 10}
            r={8}
            color={Colors.tertiary}
          />
          <SkiaText
            x={PADDING + 35}
            y={SIZE - PADDING + 18}
            text="LOCAL_SYNC_VERIFIED // VERVE_CORE_ENGINE"
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
    // Hidden off-screen but active
    position: "absolute",
    left: -SIZE * 2,
    top: -SIZE * 2,
  },
  canvas: {
    width: SIZE,
    height: SIZE,
  },
});
