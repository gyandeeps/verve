import { Link, Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { useClientOnlyValue } from "@/src/components/useClientOnlyValue";
import { useColorScheme } from "@/src/components/useColorScheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();

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
            headerRight: () =>
              __DEV__ ? (
                <Link href="/dev-settings" asChild>
                  <Pressable style={{ marginRight: 15 }}>
                    {({ pressed }) => (
                      <SymbolView
                        name={{
                          ios: "info.circle",
                          android: "info",
                          web: "info",
                        }}
                        size={25}
                        tintColor={Colors.text}
                        style={{ opacity: pressed ? 0.5 : 1 }}
                      />
                    )}
                  </Pressable>
                </Link>
              ) : null,
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
                  android: "bolt",
                  web: "bolt",
                }}
                tintColor={color}
                size={28}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="workstation"
          options={{
            title: "Workstation",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: "list.bullet.rectangle.portrait",
                  android: "list",
                  web: "list",
                }}
                tintColor={color}
                size={28}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="biometrics"
          options={{
            title: "Health",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: "heart.text.square",
                  android: "favorite",
                  web: "favorite",
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
