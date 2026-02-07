import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

export default function HomeScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState("User");

  // useFocusEffect runs every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchUserProfile = async () => {
        try {
          // 1. Get the current user session
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user && isActive) {
            // 2. Fetch the name from the 'profile' table using the user's ID
            const { data, error } = await supabase
              .from("profile")
              .select("name")
              .eq("id", user.id)
              .single();

            if (!error && data?.name) {
              setUserName(data.name);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      };

      fetchUserProfile();

      // Cleanup function to prevent setting state on unmounted component
      return () => {
        isActive = false;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Hello, {userName} 👋</Text>
          <Text style={styles.subtitle}>Welcome to Park Alert</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🅿️ Start Detection</Text>
          <Text style={styles.cardDescription}>
            Use the camera to detect parking violations in real-time.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push("/(tabs)/detect")}
          >
            <Text style={styles.buttonText}>Go to Camera</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Your Profile</Text>
          <Text style={styles.cardDescription}>
            View your violation history and account settings.
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              View Profile
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f7fb" },
  scrollContent: { padding: 20 },
  header: { marginBottom: 30, marginTop: 10 },
  greeting: { fontSize: 28, fontWeight: "bold", color: "#333" },
  subtitle: { fontSize: 16, color: "#666", marginTop: 5 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    // Box Shadow for Web & iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    color: "#333",
  },
  cardDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#007BFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryButton: { backgroundColor: "#eef2ff" },
  secondaryButtonText: { color: "#007BFF" },
});
