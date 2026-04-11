import Colors from "@/constants/Colors";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Timeframe } from "../services/StatsService";

type TimeframeSelectorProps = {
  selected: Timeframe;
  onSelect: (timeframe: Timeframe) => void;
};

export function TimeframeSelector({
  selected,
  onSelect,
}: TimeframeSelectorProps) {
  const options: { label: string; value: Timeframe }[] = [
    { label: "Today", value: "today" },
    { label: "7 Days", value: "last7days" },
    { label: "30 Days", value: "last30days" },
    { label: "All Time", value: "alltime" },
  ];

  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const isActive = selected === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={[styles.button, isActive && styles.buttonActive]}
          >
            <Text style={[styles.text, isActive && styles.textActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: Colors.surface_container_lowest,
    padding: 4,
    borderRadius: 8,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  buttonActive: {
    backgroundColor: Colors.surface_container,
  },
  text: {
    fontFamily: "SpaceGroteskBold",
    fontSize: 10,
    color: Colors.subText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textActive: {
    color: Colors.primary,
  },
});
