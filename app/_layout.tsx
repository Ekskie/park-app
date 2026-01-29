import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter, useSegments } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const userId = await AsyncStorage.getItem("user_id");
        const role = await AsyncStorage.getItem("userRole");
        const inAuthGroup = segments[0] === "(tabs)";

        // 1. If not logged in, redirect to Login
        if (!userId) {
          // Only redirect if not already on the login page to avoid loops
          if (segments[0] !== undefined) {
            // You might need to handle this logic carefully or let the initial render handle it
          }
        }
        // 2. If logged in but no role, redirect to Role Selection
        else if (userId && !role) {
          router.replace("/role-selection");
        }
        // 3. If logged in and has role, but not in tabs, redirect to Tabs
        else if (userId && role && !inAuthGroup) {
          router.replace("/(tabs)/detect");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [segments]); // Re-run when navigation segments change

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Define the possible routes. 
         Note: The 'name' must match the filename or folder name.
      */}
      <Stack.Screen name="index" />
      <Stack.Screen name="role-selection" />
      {/* This points to the app/(tabs) FOLDER */}
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
