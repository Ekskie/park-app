import { BACKEND_BASE_URL } from "@/constants/backend";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoSource, VideoView } from "expo-video";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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

const { width } = Dimensions.get("window");

export default function VideoUpload() {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [processedVideoUri, setProcessedVideoUri] = useState<string | null>(
    null,
  );
  const [snapshotUri, setSnapshotUri] = useState<string | null>(null);
  const [violationCount, setViolationCount] = useState(0);

  // Toggle between viewing original and processed video
  const [viewingProcessed, setViewingProcessed] = useState(false);

  // Progress States
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);

  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Default values
  const DEFAULT_TYPE = "Vehicle Parked in No Parking Zone";
  const DEFAULT_LOCATION = "Zone A, Camera 2";
  const DEFAULT_EVIDENCE = "Evidence Captured from CCTV Image";

  const [violationType, setViolationType] = useState(DEFAULT_TYPE);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [timeCaught, setTimeCaught] = useState(dayjs().format("hh:mm:ss A"));
  const [evidence, setEvidence] = useState(DEFAULT_EVIDENCE);

  // Ref to hold interval ID so we can clear it easily
  const pollIntervalRef = useRef<any>(null);

  // --- Video Player Logic ---
  // Determine which video to show based on state
  const currentVideoUri =
    viewingProcessed && processedVideoUri ? processedVideoUri : videoUri;

  const source: VideoSource | undefined = currentVideoUri
    ? { uri: currentVideoUri }
    : undefined;

  const player = useVideoPlayer(source || { uri: "" }, (player) => {
    if (source) {
      player.loop = true;
      player.play();
    }
  });

  // --- Cleanup on Unmount ---
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // --- After Processing ---
  useEffect(() => {
    if (processedVideoUri) {
      Alert.alert(
        "Processing Complete 🎉",
        "The video has been successfully processed!",
      );
      // Update time caught to now
      setTimeCaught(dayjs().format("hh:mm:ss A"));
      // Automatically switch to viewing the processed video
      setViewingProcessed(true);
    }
  }, [processedVideoUri]);

  // --- Reset State ---
  const resetForm = () => {
    setVideoUri(null);
    setProcessedVideoUri(null);
    setSnapshotUri(null);
    setViolationCount(0);
    setUploadProgress(0);
    setProcessingProgress(0);
    setProcessing(false);
    setViewingProcessed(false);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  };

  // --- Pick Video from Gallery ---
  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1,
      });
      if (!result.canceled && result.assets.length > 0) {
        resetForm(); // Clear previous data
        const uri = result.assets[0].uri;
        setVideoUri(uri);
      }
    } catch (error) {
      console.error("Error picking video:", error);
      Alert.alert("Error", "Could not pick video");
    }
  };

  // --- Upload Video to Flask ---
  const uploadVideo = async () => {
    const api_url = BACKEND_BASE_URL;

    if (!api_url) {
      Alert.alert(
        "Missing backend URL",
        "Update backend/ngrok_config.json with your ngrok tunnel URL.",
      );
      return;
    }

    if (!videoUri) return Alert.alert("Pick a video first");

    setProcessing(false);
    setUploadProgress(0);
    setProcessingProgress(0);
    setProcessedVideoUri(null);
    setSnapshotUri(null);
    setViolationCount(0);
    setViewingProcessed(false); // Ensure we see original during upload

    const formData = new FormData();
    if (Platform.OS === "web") {
      const response = await fetch(videoUri);
      const blob = await response.blob();
      formData.append("video", blob, "input.mp4");
    } else {
      formData.append("video", {
        uri: videoUri,
        type: "video/mp4",
        name: "input.mp4",
      } as any);
    }

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${api_url}/upload`);

      // Bypass Ngrok browser warning for XHR
      xhr.setRequestHeader("ngrok-skip-browser-warning", "true");

      // 1. Monitor Upload Progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };

      // 2. When Upload finishes, Start Polling for Processing Status
      xhr.upload.onloadend = () => {
        setProcessing(true); // Show processing UI
        setUploadProgress(100); // Ensure upload shows full

        // Start polling every 1 second
        pollIntervalRef.current = setInterval(async () => {
          try {
            // Fetch progress from backend
            const res = await fetch(`${api_url}/progress`, {
              headers: {
                "ngrok-skip-browser-warning": "true",
                "User-Agent": "ParkApp-Mobile",
              },
            });

            if (res.ok) {
              const data = await res.json();
              if (data.progress !== undefined) {
                setProcessingProgress(Math.round(data.progress));
              }
            }
          } catch (e) {
            console.log("Polling error:", e);
          }
        }, 1000);
      };

      xhr.onload = () => {
        // Stop polling when response is received
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setProcessing(false);
        setProcessingProgress(100);

        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            setViolationCount(data.tracked_objects || 0);
            setProcessedVideoUri(data.video_url);
            if (data.snapshot_url) {
              setSnapshotUri(data.snapshot_url);
            }
          } catch (err) {
            Alert.alert("Error", "Invalid server response");
          }
        } else {
          Alert.alert("Upload Failed", `Status ${xhr.status}`);
        }
      };

      xhr.onerror = () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        Alert.alert("Network Error", "Could not upload video");
        setProcessing(false);
      };

      xhr.send(formData);
    } catch (err: any) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setProcessing(false);
      Alert.alert("Error", err.message || "Unknown error");
    }
  };

  // --- Save Violation Record ---
  const handleSave = async () => {
    if (!processedVideoUri)
      return Alert.alert("⚠️", "Process a video before saving.");

    // Validation
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
          recorded_number: violationCount,
          violation_type: violationType,
          location,
          time_caught: timeCaught,
          evidence,
        },
      ]);

      if (error) throw error;

      // Success Message with Reset Action
      Alert.alert("✅ Success", "Violation record saved successfully!", [
        {
          text: "Save Another",
          onPress: resetForm,
        },
        {
          text: "OK",
          style: "cancel",
        },
      ]);
    } catch (error: any) {
      console.error(error);
      Alert.alert("Save Failed", error.message || "Could not save violation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.pageContainer}>
          {/* Pick & Upload */}
          <View style={styles.container}>
            <TouchableOpacity style={styles.button} onPress={pickVideo}>
              <Text style={styles.buttonText}>🎥 Pick Video</Text>
            </TouchableOpacity>
          </View>

          {videoUri && (
            <View style={styles.container}>
              <TouchableOpacity
                style={[styles.button, styles.processButton]}
                onPress={uploadVideo}
              >
                <Text style={styles.buttonText}>🚦 Start Detection</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.resetButton]}
                onPress={resetForm}
              >
                <Text style={[styles.buttonText, styles.resetText]}>
                  ❌ Clear Selection
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Video Preview */}
          {videoUri && (
            <View style={styles.videoWrapper}>
              <Text style={styles.sectionTitle}>
                {viewingProcessed ? "✅ Processed Video" : "Original Video"}
              </Text>

              {/* Toggle Buttons (Only visible if processed video exists) */}
              {processedVideoUri && (
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      !viewingProcessed && styles.toggleActive,
                    ]}
                    onPress={() => setViewingProcessed(false)}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        !viewingProcessed && styles.toggleTextActive,
                      ]}
                    >
                      Original
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      viewingProcessed && styles.toggleActive,
                    ]}
                    onPress={() => setViewingProcessed(true)}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        viewingProcessed && styles.toggleTextActive,
                      ]}
                    >
                      Processed
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <VideoView
                player={player}
                style={{ width: width - 40, height: 200 }}
                nativeControls
                contentFit="contain"
              />
            </View>
          )}

          {/* Snapshot with Bounding Boxes */}
          {snapshotUri && (
            <View style={styles.videoWrapper}>
              <Text style={styles.sectionTitle}>Detected Snapshot</Text>
              <Image
                source={{ uri: snapshotUri }}
                style={{ width: width - 40, height: 200, borderRadius: 12 }}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Upload Progress Indicator */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <View style={{ marginVertical: 15 }}>
              <Text style={{ fontWeight: "600", marginBottom: 5 }}>
                Uploading: {uploadProgress}%
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${uploadProgress}%` }]}
                />
              </View>
            </View>
          )}

          {/* Processing Progress Indicator (Shows after upload finishes) */}
          {processing && (
            <View style={{ marginVertical: 20 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <ActivityIndicator
                  size="small"
                  color="#007BFF"
                  style={{ marginRight: 10 }}
                />
                <Text style={{ fontWeight: "600", color: "#555" }}>
                  Processing Video: {processingProgress}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${processingProgress}%`,
                      backgroundColor: "#28a745",
                    },
                  ]}
                />
              </View>
              <Text style={{ fontSize: 12, color: "#888", marginTop: 5 }}>
                Analyzing frames with AI... please wait.
              </Text>
            </View>
          )}

          {/* Violation Info */}
          <View style={styles.detailsContainer}>
            <Text style={styles.label}>
              Violations Caught: {violationCount}
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

            <Text style={styles.fieldLabel}>Evidence</Text>
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
                  backgroundColor: loading ? "#ccc" : "#28a745",
                  marginTop: 10,
                },
              ]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>💾 Save Violation Record</Text>
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
  container: { marginBottom: 12 },
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
  processButton: { backgroundColor: "#6c757d", marginBottom: 10 },
  resetButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ff4d4d",
  },
  resetText: { color: "#ff4d4d" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  videoWrapper: {
    alignItems: "center",
    marginTop: 20,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
    alignSelf: "flex-start",
  },
  progressBar: {
    width: "100%",
    height: 10,
    backgroundColor: "#e0e0e0",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#007BFF" },
  detailsContainer: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    marginTop: 24,
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
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#eee",
    borderRadius: 8,
    padding: 2,
    marginBottom: 10,
    alignSelf: "stretch",
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleText: { fontSize: 12, fontWeight: "600", color: "#777" },
  toggleTextActive: { color: "#007BFF" },
});
