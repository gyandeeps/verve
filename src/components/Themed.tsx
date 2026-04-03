/**
 * Learn more about Light and Dark modes:
 * https://docs.expo.io/guides/color-schemes/
 */
import { Text as DefaultText, View as DefaultView } from "react-native";

import Colors from "@/constants/Colors";

type ThemeProps = {
  lightColor?: string; // Kept for interface compatibility
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText["props"];
export type ViewProps = ThemeProps & DefaultView["props"];

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors,
) {
  // We unified the design system into a single slate/dark theme:
  // Fallback to explicit prop if provided (e.g. darkColor), otherwise use our design system
  const colorFromProps = props.dark ?? props.light;

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[colorName];
  }
}

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");

  return (
    <DefaultText
      style={[{ color, fontFamily: "Inter" }, style]}
      {...otherProps}
    />
  );
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;

  // We no longer force a default background color on all Views.
  // This prevents children of cards from overriding their parent's background.
  // If an explicit color is provided via props (lightColor/darkColor), we use it.
  const backgroundColor =
    lightColor || darkColor
      ? useThemeColor({ light: lightColor, dark: darkColor }, "background")
      : undefined;

  return (
    <DefaultView
      style={[backgroundColor ? { backgroundColor } : null, style]}
      {...otherProps}
    />
  );
}
