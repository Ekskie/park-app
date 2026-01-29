import { supabase } from "@/lib/supabase";
import { FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs, useRouter } from "expo-router";
import React from "react";
import { Alert, Button, Platform } from "react-native";

export default function TabLayout() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // 1. Sign out from Supabase Auth
      await supabase.auth.signOut();

      // 2. Clear all local storage keys used in the app
      await AsyncStorage.removeItem("user_id");
      await AsyncStorage.removeItem("userRole");
      // Clear potential legacy keys from your snippet
      await AsyncStorage.removeItem("userId");
      await AsyncStorage.removeItem("userEmail");

      // 3. Navigate back to the login screen
      router.replace("/");
    } catch (err: any) {
      Alert.alert("Error", "Failed to logout: " + err.message);
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
        name="index"
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
