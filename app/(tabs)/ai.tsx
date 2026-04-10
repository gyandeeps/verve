import Colors from "@/constants/Colors";
import { SystemAIMonitor } from "@/src/components/insights/SystemAIMonitor";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function AIScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>System Intelligence</Text>
        <Text style={styles.subtitle}>
          On-device private AI core management
        </Text>
      </View>
      <SystemAIMonitor />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.subText,
    marginTop: 4,
  },
  infoSection: {
    marginTop: 32,
    padding: 20,
    backgroundColor: Colors.surface_container,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.text,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.subText,
    lineHeight: 22,
    marginBottom: 16,
  },
  bulletContainer: {
    gap: 8,
  },
  bullet: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: "600",
  },
});
