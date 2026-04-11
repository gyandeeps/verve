import Colors from "@/constants/Colors";
import { useClientOnlyValue } from "@/src/components/useClientOnlyValue";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TabLayout() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.subText,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopWidth: 1.5,
            borderTopColor: Colors.surface_container,
          },
          headerStyle: {
            backgroundColor: Colors.surface,
            shadowOpacity: 0,
            elevation: 0,
          },
          headerTintColor: Colors.text,
          // Disable the static render of the header on web
          // to prevent a hydration error in React Navigation v6.
          headerShown: useClientOnlyValue(false, false),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Insights",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: "chart.bar.xaxis",
                  android: "insights",
                  web: "insights",
                }}
                tintColor={color}
                size={28}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: "Stats",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: "chart.pie",
                  android: "social_leaderboard",
                  web: "leaderboard",
                }}
                tintColor={color}
                size={28}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="monitor"
          options={{
            title: "Monitor",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: "waveform.path.ecg",
                  android: "monitoring",
                  web: "bolt",
                }}
                tintColor={color}
                size={28}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="sessions"
          options={{
            title: "Sessions",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: "square.stack.3d.up",
                  android: "stacks",
                  web: "stacks",
                }}
                tintColor={color}
                size={28}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: "gearshape.fill",
                  android: "settings",
                }}
                tintColor={color}
                size={28}
              />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
