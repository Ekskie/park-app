import { BACKEND_BASE_URL } from '@/constants/backend';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoSource, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function VideoUpload() {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [processedVideoUri, setProcessedVideoUri] = useState<string | null>(null);
  const [snapshotUri, setSnapshotUri] = useState<string | null>(null);
  const [violationCount, setViolationCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [violationType, setViolationType] = useState('Vehicle Parked in No Parking Zone');
  const [location, setLocation] = useState('Zone A, Camera 2');
  const [timeCaught, setTimeCaught] = useState(dayjs().format('hh:mm:ss A'));
  const [evidence, setEvidence] = useState('Evidence Captured from CCTV Image');

  // --- Video Player ---
  const source: VideoSource | undefined =
    processedVideoUri
      ? { uri: processedVideoUri }
      : videoUri
      ? { uri: videoUri }
      : undefined;

  const player = useVideoPlayer(source || { uri: '' }, (player) => {
    if (source) {
      player.loop = true;
      player.play();
    }
  });

  // --- After Processing ---
  useEffect(() => {
    if (processedVideoUri) {
      Alert.alert('Processing Complete 🎉', 'The video has been successfully processed!');
    }
  }, [processedVideoUri]);

  // --- Pick Video from Gallery ---
  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setVideoUri(uri);
      setProcessedVideoUri(null);
      setSnapshotUri(null);
      setViolationCount(0);
    }
  };

  // --- Upload Video to Flask ---
  const uploadVideo = async () => {
    const api_url = BACKEND_BASE_URL;

    if (!api_url) {
      Alert.alert('Missing backend URL', 'Update backend/ngrok_config.json with your ngrok tunnel URL.');
      return;
    }

    if (!videoUri) return alert('Pick a video first');

    setProcessing(false);
    setUploadProgress(0);
    setProcessedVideoUri(null);
    setSnapshotUri(null);
    setViolationCount(0);

    const formData = new FormData();
    if (Platform.OS === 'web') {
      // On web, fetch the URI to get a real Blob/File; RN web FormData needs a File/Blob.
      const response = await fetch(videoUri);
      const blob = await response.blob();
      formData.append('video', blob, 'input.mp4');
    } else {
      // Native: send the file via URI.
      formData.append('video', {
        uri: videoUri,
        type: 'video/mp4',
        name: 'input.mp4',
      } as any);
    }

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${api_url}/upload`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };

      xhr.onloadstart = () => setProcessing(true);
      xhr.onloadend = () => setProcessing(false);

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            setViolationCount(data.tracked_objects || 0);
            setProcessedVideoUri(data.video_url);
            if (data.snapshot_url) {
              setSnapshotUri(data.snapshot_url);
            }
          } catch (err) {
            Alert.alert('Error', 'Invalid server response');
          }
        } else {
          Alert.alert('Upload Failed', `Status ${xhr.status}`);
        }
      };

      xhr.onerror = () => {
        Alert.alert('Network Error', 'Could not upload video');
        setProcessing(false);
      };

      xhr.send(formData);
    } catch (err: any) {
      setProcessing(false);
      Alert.alert('Error', err.message || 'Unknown error');
    }
  };

  // --- Save Violation Record ---
  const handleSave = async () => {
    if (!processedVideoUri) return Alert.alert('⚠️', 'Process a video before saving.');
    const userId = await AsyncStorage.getItem('user_id');

    try {
      setLoading(true);
      const { error } = await supabase.from('violation_history').insert([
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
      Alert.alert('✅ Success', 'Violation record saved successfully!');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.pageContainer}>
      {/* Pick & Upload */}
      <View style={styles.container}>
        <TouchableOpacity style={styles.button} onPress={pickVideo}>
          <Text style={styles.buttonText}>🎥 Pick Video</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <TouchableOpacity style={styles.button} onPress={uploadVideo}>
          <Text style={styles.buttonText}>🚦 Start Detection</Text>
        </TouchableOpacity>
      </View>

      {/* Video Preview */}
      {videoUri && (
        <View style={styles.videoWrapper}>
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
          <Text style={{ marginBottom: 6, fontWeight: '600' }}>Detected Snapshot</Text>
          <Image
            source={{ uri: snapshotUri }}
            style={{ width: width - 40, height: 200, borderRadius: 12 }}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Progress Indicators */}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <View style={{ marginVertical: 15 }}>
          <Text style={{ fontWeight: '600' }}>Uploading: {uploadProgress}%</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
        </View>
      )}

      {processing && (
        <View style={{ alignItems: 'center', marginVertical: 10 }}>
          <ActivityIndicator size="large" color="#007BFF" />
          <Text style={{ marginTop: 6 }}>Processing video on server...</Text>
        </View>
      )}

      {/* Violation Info */}
      <View style={styles.detailsContainer}>
        <Text style={styles.label}>Violations Caught: {violationCount}</Text>

        <TextInput style={styles.input} value={violationType} onChangeText={setViolationType} placeholder="Violation Type" />
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Location" />
        <TextInput style={styles.input} value={timeCaught} onChangeText={setTimeCaught} placeholder="Time Caught" />
        <TextInput style={styles.input} value={evidence} onChangeText={setEvidence} placeholder="Evidence" />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: loading ? '#ccc' : '#007BFF' }]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Saving...' : '💾 Save Violation'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pageContainer: { padding: 20, backgroundColor: '#f6f7fb' },
  container: { padding: 8 },
  button: { backgroundColor: '#007BFF', borderRadius: 50, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', width: '100%' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  videoWrapper: { alignItems: 'center', marginTop: 10 },
  progressBar: { width: '100%', height: 6, backgroundColor: '#ccc', borderRadius: 3, marginTop: 4 },
  progressFill: { height: 6, backgroundColor: '#007BFF', borderRadius: 3 },
  detailsContainer: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginTop: 20 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#fff', padding: 10, borderRadius: 8, borderColor: '#ccc', borderWidth: 1, marginBottom: 12 },
});
