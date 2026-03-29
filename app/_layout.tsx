import { databaseService } from "@/db/DatabaseService";
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { DarkTheme, Theme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import Colors from "@/constants/Colors";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    Inter: Inter_400Regular,
    InterSemi: Inter_600SemiBold,
    InterBold: Inter_700Bold,
    InterExtraBold: Inter_800ExtraBold,
    SpaceGrotesk: SpaceGrotesk_400Regular,
    SpaceGroteskSemi: SpaceGrotesk_600SemiBold,
    SpaceGroteskBold: SpaceGrotesk_700Bold,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      // Initialize the database service to handle persistence
      databaseService
        .init()
        .catch((err) => console.error("Database initialization failed:", err));
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const ConsoleTheme: Theme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: Colors.primary,
      background: Colors.background,
      card: Colors.surface,
      text: Colors.text,
      border: Colors.surface_container,
      notification: Colors.secondary,
    },
  };

  return (
    <ThemeProvider value={ConsoleTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
    </ThemeProvider>
  );
}
