import Colors from "@/constants/Colors";
import Layout from "@/constants/Layout";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView, SymbolViewProps } from "expo-symbols";
import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";

interface GradientButtonProps {
  title?: string;
  onPress: () => void;
  variant?: "console" | "danger" | "secondary" | "ghost";
  size?: "small" | "large";
  icon?: SymbolViewProps["name"];
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  title,
  onPress,
  variant = "console",
  size = "large",
  icon,
  loading = false,
  disabled = false,
  style,
}) => {
  const getColors = () => {
    switch (variant) {
      case "danger":
        return ["#790125ff", "#440115ff"];
      case "secondary":
      case "ghost":
        return [Colors.surface_container_highest, Colors.surface_container];
      case "console":
      default:
        return ["#162e75", "#0a1433"];
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case "danger":
      case "console":
        return "#ffffff";
      case "secondary":
      case "ghost":
      default:
        return Colors.text;
    }
  };

  const getBorderColor = () => {
    switch (variant) {
      case "secondary":
        return Colors.secondary;
      default:
        return Colors.outline_variant;
    }
  };

  const getIconColor = () => getTextColor();

  const gradientColors = getColors() as [string, string];
  const textColor = getTextColor();
  const iconColor = getIconColor();
  const borderColor = getBorderColor();

  return (
    <TouchableOpacity
      style={[styles.wrapper, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.button,
          { borderColor },
          size === "small" && styles.buttonSmall,
          !title && size === "small" && styles.buttonSquare,
          (disabled || loading) && { opacity: 0.7 },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <>
            {title && (
              <Text
                style={[
                  styles.text,
                  { color: textColor },
                  size === "small" && styles.textSmall,
                ]}
              >
                {title}
              </Text>
            )}
            {icon && (
              <SymbolView
                name={icon}
                size={size === "small" ? 14 : 18}
                tintColor={iconColor}
              />
            )}
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Layout.borderRadius,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: Layout.borderRadius,
    borderWidth: 1,
    borderColor: Colors.outline_variant,
    gap: 12,
  },
  buttonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  buttonSquare: {
    width: 40,
    height: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  text: {
    fontSize: 12,
    fontFamily: "SpaceGroteskBold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  textSmall: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
});
