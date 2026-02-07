import { FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter } from "expo-router";
import * as Updates from "expo-updates";
import React from "react";
import { Alert, Button, Platform } from "react-native";
import { supabase } from "../../lib/supabase";

export default function TabLayout() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // 1. Sign out from Supabase Auth
      await supabase.auth.signOut();

      // 2. Clear all local storage keys used in the app
      await AsyncStorage.removeItem("user_id");
      await AsyncStorage.removeItem("userRole");
      // Clear potential legacy keys
      await AsyncStorage.removeItem("userId");
      await AsyncStorage.removeItem("userEmail");

      // 3. Reload the app to ensure a completely clean state.
      // This forces the app to reload the bundle, clearing all in-memory state (Auth Guard, variables, etc.)
      // and restarting at the entry point (Login Screen).
      await Updates.reloadAsync();
    } catch (err: any) {
      // Fallback if reload fails (e.g. in some dev environments)
      Alert.alert("Logout", "You have been logged out.");
      router.replace("/");
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: true, // Enable header to show the Logout button
        headerRight: () => (
          <Button
            onPress={handleLogout}
            title="Logout"
            color={Platform.OS === "ios" ? undefined : "#FF3B30"}
          />
        ),
        headerRightContainerStyle: { paddingRight: 15 },
        tabBarStyle: Platform.select({
          ios: {
            position: "absolute",
          },
          default: {},
        }),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="home" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="detect"
        options={{
          title: "Detect",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="camera" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="realtime_detect"
        options={{
          title: "Realtime",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="video" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="user" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
