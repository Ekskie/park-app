import { BACKEND_BASE_URL } from "@/constants/backend";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import io from "socket.io-client";

// Robust Socket Configuration
const socket = io(BACKEND_BASE_URL, {
  transports: ["websocket"],
  extraHeaders: {
    "ngrok-skip-browser-warning": "true",
  },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  timeout: 20000,
});

export default function RealtimeDetect() {
  // --- Camera & Socket State ---
  const [permission, requestPermission] = useCameraPermissions();
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [hasViolation, setHasViolation] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [debugMsg, setDebugMsg] = useState("Initializing...");
  const cameraRef = useRef<CameraView>(null);
  const isSending = useRef(false);

  // --- Form & Supabase State ---
  const [violationCount, setViolationCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const DEFAULT_TYPE = "Vehicle Parked in No Parking Zone";
  const DEFAULT_LOCATION = "Zone A, Camera 1 (Live)";
  const DEFAULT_EVIDENCE = "Real-time AI Detection";

  const [violationType, setViolationType] = useState(DEFAULT_TYPE);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [timeCaught, setTimeCaught] = useState(dayjs().format("hh:mm:ss A"));
  const [evidence, setEvidence] = useState(DEFAULT_EVIDENCE);

  // --- Socket Logic ---
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to server:", socket.id);
      setIsConnected(true);
      setDebugMsg("Connected");
    });

    socket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
      setIsConnected(false);
      setDebugMsg(`Disconnected: ${reason}`);
      isSending.current = false;
    });

    socket.on("connect_error", (err) => {
      console.error("Connection Error:", err.message);
      setDebugMsg(`Error: ${err.message}`);
    });

    socket.on("response", (data) => {
      setProcessedImage(data.image);
      setHasViolation(data.violation);
      // Update count from backend if provided, otherwise generic increment
      if (data.total_violations !== undefined) {
        setViolationCount(data.total_violations);
      }

      // Update time if violation just started
      if (data.violation) {
        setTimeCaught(dayjs().format("hh:mm:ss A"));
      }
    });

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("response");
    };
  }, []);

  const sendFrame = async () => {
    if (cameraRef.current && isConnected && !isSending.current) {
      try {
        isSending.current = true;
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.2,
        });

        if (photo?.base64) {
          if (photo.base64.length > 1000000) {
            console.warn(`Frame skipped: Too large`);
          } else {
            socket.emit("frame", `data:image/jpeg;base64,${photo.base64}`);
          }
        }
      } catch (e) {
        console.log("Capture error:", e);
      } finally {
        setTimeout(() => {
          isSending.current = false;
        }, 100);
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(sendFrame, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // --- Save Logic (From Upload Screen) ---
  const handleSave = async () => {
    if (!hasViolation && violationCount === 0) {
      Alert.alert("⚠️", "No violations detected yet.");
      // Optional: return; // Uncomment to force detection before saving
    }

    if (!violationType.trim() || !location.trim()) {
      return Alert.alert(
        "Validation Error",
        "Please ensure Violation Type and Location are filled.",
      );
    }

    const userId = await AsyncStorage.getItem("user_id");

    if (!userId) {
      return Alert.alert("Error", "User ID not found. Please log in again.");
    }

    try {
      setLoading(true);
      const { error } = await supabase.from("violation_history").insert([
        {
          profile: userId,
          recorded_number: violationCount || 1, // Default to 1 if count is 0 but user forced save
          violation_type: violationType,
          location,
          time_caught: timeCaught,
          evidence,
        },
      ]);

      if (error) throw error;

      Alert.alert("✅ Success", "Live violation record saved successfully!");
    } catch (error: any) {
      console.error(error);
      Alert.alert("Save Failed", error.message || "Could not save violation.");
    } finally {
      setLoading(false);
    }
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={{ color: "white", fontSize: 18 }}>
          Permission required
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.pageContainer}>
          {/* --- Camera Section --- */}
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
            />

            {/* Overlay Processed Image */}
            {processedImage && (
              <Image
                source={{ uri: processedImage }}
                style={[
                  StyleSheet.absoluteFill,
                  hasViolation && styles.violationBorder,
                ]}
                resizeMode="contain"
              />
            )}

            {/* Status Indicators */}
            <View style={styles.status}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: isConnected ? "#4CAF50" : "#F44336" },
                ]}
              />
              <Text style={styles.statusText}>
                {isConnected ? "Live" : debugMsg}
              </Text>
            </View>

            {hasViolation && (
              <View style={styles.violationBanner}>
                <Text style={styles.violationText}>
                  ⚠️ VIOLATION DETECTED ⚠️
                </Text>
              </View>
            )}
          </View>

          {/* --- Form Section --- */}
          <View style={styles.detailsContainer}>
            <Text style={styles.label}>
              Live Violations Caught: {violationCount}
            </Text>

            <Text style={styles.fieldLabel}>Violation Type</Text>
            <TextInput
              style={styles.input}
              value={violationType}
              onChangeText={setViolationType}
              placeholder="Type"
            />

            <Text style={styles.fieldLabel}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Location"
            />

            <Text style={styles.fieldLabel}>Time Caught</Text>
            <TextInput
              style={styles.input}
              value={timeCaught}
              onChangeText={setTimeCaught}
              placeholder="Time"
            />

            <Text style={styles.fieldLabel}>Evidence Source</Text>
            <TextInput
              style={styles.input}
              value={evidence}
              onChangeText={setEvidence}
              placeholder="Evidence"
            />

            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: loading
                    ? "#ccc"
                    : hasViolation
                      ? "#dc3545"
                      : "#28a745",
                  marginTop: 10,
                },
              ]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {hasViolation
                    ? "🚨 Save Detected Violation"
                    : "💾 Save Record"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageContainer: { padding: 20, paddingBottom: 50 },
  container: { flex: 1, backgroundColor: "black" },

  // Camera Styles
  cameraContainer: {
    height: 300,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "black",
    marginBottom: 20,
    position: "relative",
  },
  status: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { color: "white", fontWeight: "bold", fontSize: 14 },

  // Violation Styles
  violationBorder: { borderWidth: 5, borderColor: "red" },
  violationBanner: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    backgroundColor: "red",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  violationText: { color: "white", fontWeight: "bold", fontSize: 16 },

  // Form Styles
  detailsContainer: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  label: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    color: "#333",
    textAlign: "center",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
    marginLeft: 4,
  },
  input: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
    borderColor: "#eee",
    borderWidth: 1,
    marginBottom: 12,
    fontSize: 14,
  },
  button: {
    backgroundColor: "#007BFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
