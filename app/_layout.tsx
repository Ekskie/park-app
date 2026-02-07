import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
// import { useFonts } from 'expo-font'; // Commented out missing font
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "@supabase/supabase-js";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";

import { supabase } from "../lib/supabase";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // NOTE: Font loading is commented out because the file was reported missing.
  // If you add assets/fonts/SpaceMono-Regular.ttf back, you can uncomment this.
  /*
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  */
  const fontsLoaded = true; // Bypass font check

  // Auth & State
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const segments = useSegments();
  const router = useRouter();

  // 1. Initial Load: Auth + Role
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Get initial session
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        setSession(initialSession);

        // Get persisted role
        const savedRole = await AsyncStorage.getItem("userRole");
        setUserRole(savedRole);
      } catch (e) {
        console.error("Initialization error:", e);
      } finally {
        setIsReady(true);
      }
    };

    initializeApp();

    // Listen for real-time auth changes (Login/Logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      // If we just logged in, we might need to refresh the role
      if (session) {
        const role = await AsyncStorage.getItem("userRole");
        setUserRole(role);
      } else {
        // If logged out, clear role state
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Hide Splash Screen when ready
  useEffect(() => {
    if (fontsLoaded && isReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isReady]);

  // 3. The Auth Guard: Traffic Control
  useEffect(() => {
    if (!isReady || !fontsLoaded) return;

    const performGuard = async () => {
      const inAuthGroup = segments[0] === "(tabs)";
      const inRoleSelection = segments[0] === "role-selection";
      const inPublicGroup =
        segments[0] === undefined || (segments[0] as string) === "index";

      // A. Not Logged In
      if (!session) {
        if (inAuthGroup || inRoleSelection) {
          router.replace("/");
        }
        return; // Exit early
      }

      // B. Logged In
      // CRITICAL FIX: If state says no role, double-check storage before redirecting.
      // This handles the split-second after role-selection updates storage but before state updates.
      let currentRole = userRole;
      if (!currentRole) {
        currentRole = await AsyncStorage.getItem("userRole");
        if (currentRole) {
          setUserRole(currentRole); // Sync state for next time
        }
      }

      // 1. Missing Role -> Go to Role Selection
      if (!currentRole) {
        if (!inRoleSelection) {
          router.replace("/role-selection");
        }
      }
      // 2. Has Role -> Go to Tabs (Detect)
      else {
        // If user is on Login or Role Selection, send them to the main app
        if (inPublicGroup || inRoleSelection) {
          router.replace("/(tabs)/home");
        }
      }
    };

    performGuard();
  }, [session, userRole, segments, isReady, fontsLoaded]);

  if (!fontsLoaded || !isReady) {
    return (
      // Forcing white background for loading screen
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  return (
    // Forcing DefaultTheme (Light Mode)
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="role-selection" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
