import React from "react";
import Svg, { Polyline } from "react-native-svg";
import Colors from "@/constants/Colors";

interface HRSparklineProps {
  samples: any[];
  width: number;
  height: number;
  strokeWidth?: number;
  color?: string;
}

export function HRSparkline({
  samples,
  width,
  height,
  strokeWidth = 1.5,
  color = Colors.primary,
}: HRSparklineProps) {
  if (!samples || samples.length < 2) return null;

  const minBpm = Math.min(...samples.map((s) => s.bpm)) - 5;
  const maxBpm = Math.max(...samples.map((s) => s.bpm)) + 5;
  const range = maxBpm - minBpm || 1;
  const timeStart = samples[0].ts;
  const timeRange = samples[samples.length - 1].ts - timeStart || 1;

  const points = samples
    .map((s) => {
      const x = ((s.ts - timeStart) / timeRange) * width;
      const y = height - ((s.bpm - minBpm) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Svg width={width} height={height}>
      {/* Glow Effect */}
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth + 2}
        strokeLinejoin="round"
        opacity={0.15}
      />
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
