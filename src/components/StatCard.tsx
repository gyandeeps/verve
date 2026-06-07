import Colors from "@/constants/Colors";
import { SymbolView } from "expo-symbols";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

type StatCardProps = {
  title: string;
  value: string;
  subtext?: string;
  icon?: {
    ios: string;
    android: string;
    web: string;
  };
};

export function StatCard({ title, value, subtext, icon }: StatCardProps) {
  return (
    <Animated.View
      entering={FadeInUp.springify().damping(15).stiffness(100)}
      style={styles.container}
    >
      <Animated.View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {icon && (
          <SymbolView name={icon as any} size={18} tintColor={Colors.subText} />
        )}
      </Animated.View>
      <Text style={styles.value}>{value}</Text>
      {subtext && <Text style={styles.subtext}>{subtext}</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface_container,
    borderRadius: 6, // md
    padding: 20,
    marginBottom: 20, // Spacing 8 -> Match index.tsx Hero Card margin
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "SpaceGroteskBold",
    fontSize: 11,
    color: Colors.subText,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  value: {
    fontFamily: "InterExtraBold",
    fontSize: 32,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtext: {
    fontFamily: "SpaceGrotesk",
    fontSize: 11,
    color: Colors.primary,
    marginTop: 8,
    letterSpacing: 0.5,
  },
});
