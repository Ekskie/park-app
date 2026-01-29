import { BACKEND_BASE_URL, NGROK_CONFIG_LOCATION } from '@/constants/backend';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface Violation {
  id: number;
  recorded_number:number;
  violation_type: string;
  location: string;
  time_caught: string;
  evidence: string;
}

export default function Profile() {
  const [profileImage, setProfileImage] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileRole, setProfileRole] = useState('');
  const [totalViolations, setTotalViolations] = useState(0);
  const [violationMonth, setViolationMonth] = useState(0);
  const [mostCommon, setMostCommon] = useState('No Parking Zone');
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<Violation[]>([]);

  const updateViolationStats = useCallback((violationsData: any[]) => {
    setViolations(violationsData);
    setTotalViolations(violationsData.length);

    const currentMonth = new Date().getMonth();
    const monthCount = violationsData.filter(
      (v) => new Date(v.created_at).getMonth() === currentMonth
    ).length;
    setViolationMonth(monthCount);

    const typeCount: Record<string, number> = {};
    violationsData.forEach((v) => {
      if (v.violation_type)
        typeCount[v.violation_type] = (typeCount[v.violation_type] || 0) + 1;
    });
    const mostCommonType = Object.keys(typeCount).reduce(
      (a, b) => (typeCount[a] > typeCount[b] ? a : b),
      'No Parking Zone'
    );
    setMostCommon(mostCommonType);
  }, []);

  const handleRealtimeChange = useCallback((payload: any) => {
    if (!payload) return;

    setViolations((prev) => {
      let updated = [...prev];
      const newRecord = payload.new;
      const oldRecord = payload.old;

      switch (payload.eventType) {
        case 'INSERT':
          updated = [newRecord, ...prev];
          break;
        case 'UPDATE':
          updated = prev.map((v) => (v.id === newRecord.id ? newRecord : v));
          break;
        case 'DELETE':
          updated = prev.filter((v) => v.id !== oldRecord.id);
          break;
      }

      updateViolationStats(updated);
      return updated;
    });
  }, [updateViolationStats]);

  useEffect(() => {
    const fetchProfileAndViolations = async () => {
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) return;

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profile')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) console.error('Error fetching profile:', profileError);
      else if (profile) {
        setProfileName(profile.name || '');
        setProfileRole(profile.role || '');
        setProfileImage(profile.profile_image || '');
      }

      // Fetch violations
      const { data: violationsData, error: violationError } = await supabase
        .from('violation_history')
        .select('*')
        .eq('profile', userId)
        .order('created_at', { ascending: false });

      if (violationError) console.error('Error fetching violations:', violationError);
      else if (violationsData) updateViolationStats(violationsData);

      setLoading(false);

      // ✅ Subscribe to realtime changes in violation_history
      const subscription = supabase
        .channel('realtime:violation_history')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'violation_history', filter: `profile=eq.${userId}` },
          (payload) => {
            console.log('📡 Realtime change:', payload);
            handleRealtimeChange(payload);
          }
        )
        .subscribe();

      // Cleanup
      return () => {
        supabase.removeChannel(subscription);
      };
    };

    fetchProfileAndViolations();
  }, [handleRealtimeChange, updateViolationStats]);

  const changeAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) return;

      const { error } = await supabase
        .from('profile')
        .update({ profile_image: uri })
        .eq('id', userId);

      if (error) {
        console.error('Error updating avatar:', error);
        Alert.alert('Error', 'Failed to update avatar');
      } else {
        setProfileImage(uri);
        Alert.alert('Success', 'Avatar updated successfully 🎉');
      }
    }
  };

  const exportToPDF = async () => {
    if (violations.length === 0) {
      Alert.alert('No data', 'There are no violations to export.');
      return;
    }

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Violation Report</title>
          <style>
            body { font-family: Arial; padding: 20px; }
            h1 { text-align: center; color: #007BFF; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background-color: #f4f6fb; }
          </style>
        </head>
        <body>
          <h1>Violation History Report</h1>
          <table>
            <tr><th>#</th><th>Violation Type</th><th>Location</th><th>Time</th><th>Recorded</th></tr>
            ${violations
              .map(
                (v, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${v.violation_type || '—'}</td>
                    <td>${v.location || '—'}</td>
                    <td>${v.time_caught || '—'}</td>
                    <td>${v.recorded_number || '—'}</td>
                  </tr>`
              )
              .join('')}
          </table>
        </body>
      </html>
    `;

    const fileUri = `${FileSystem.documentDirectory}violations_report.pdf`;
    await FileSystem.writeAsStringAsync(fileUri, html, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    try {
      await Sharing.shareAsync(fileUri);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to share the PDF file.');
    }
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading profile...</Text>
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.pageContainer}>
      <View style={styles.profileHeader}>
        <Image
          source={
            profileImage
              ? { uri: profileImage }
              : require('@/assets/images/react-logo.png')
          }
          style={styles.avatar}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.nameText}>Welcome, {profileName || 'User'}</Text>
          <Text style={styles.roleText}>Role: {profileRole || 'Staff'}</Text>
          <TouchableOpacity onPress={changeAvatar}>
            <Text style={styles.changeAvatar}>Change Avatar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ✅ Backend URL (ngrok) */}
      <View style={styles.serverContainer}>
        <Text style={styles.serverLabel}>Backend URL (ngrok tunnel)</Text>
        <Text style={styles.serverInfo}>
          {BACKEND_BASE_URL || 'Update backend/ngrok_config.json with your tunnel URL'}
        </Text>
        <Text style={styles.serverHint}>
          Edit {NGROK_CONFIG_LOCATION} after you start ngrok so the app and server stay in sync.
        </Text>
      </View>

      {/* ✅ Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>Dashboard Summary</Text>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Violations</Text>
            <Text style={styles.statValue}>{totalViolations}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>This Month</Text>
            <Text style={styles.statValue}>{violationMonth}</Text>
          </View>
        </View>

        <View style={styles.statBoxFull}>
          <Text style={styles.statLabel}>Most Common Violation</Text>
          <Text style={styles.statValue}>{mostCommon}</Text>
        </View>
      </View>

      {/* ✅ Violation History Section */}
      <View style={styles.historyContainer}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Violation History</Text>
          <TouchableOpacity style={styles.exportButton} onPress={exportToPDF}>
            <Text style={styles.exportText}>Export PDF</Text>
          </TouchableOpacity>
        </View>

        {violations.length === 0 ? (
          <Text style={styles.noViolations}>No violations recorded yet.</Text>
        ) : (
          violations.map((v, index) => (
            <View key={v.id || index} style={styles.historyItem}>
              <Text style={styles.historyLabel}>
                {index + 1}. {v.violation_type || 'Unknown Violation'}
              </Text>
              <Text style={styles.historySub}>📍 {v.location || 'N/A'}</Text>
              <Text style={styles.historySub}>🕒 {v.time_caught || '—'}</Text>
              <Text style={styles.historySub}>🚦 {v.recorded_number || '—'}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pageContainer: { flexGrow: 1, padding: 20, backgroundColor: '#f4f6fb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
  },
  avatar: { width: 80, height: 80, borderRadius: 50, backgroundColor: '#e0e0e0' },
  profileInfo: { marginLeft: 16, flex: 1 },
  nameText: { fontSize: 18, fontWeight: '700', color: '#333' },
  roleText: { fontSize: 14, color: '#555', marginVertical: 4 },
  changeAvatar: { fontSize: 14, color: '#007BFF', fontWeight: '600', marginTop: 6 },
  serverContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
  },
  serverLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#333' },
  serverInfo: { fontSize: 14, fontWeight: '600', color: '#222' },
  serverHint: { fontSize: 12, color: '#666', marginTop: 6 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 3, marginBottom: 20 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  statBox: { flex: 1, backgroundColor: '#f8f9ff', borderRadius: 12, padding: 12, alignItems: 'center', marginHorizontal: 4 },
  statBoxFull: { backgroundColor: '#f8f9ff', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 10 },
  statLabel: { fontSize: 13, color: '#555' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#222', marginTop: 4 },
  historyContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 3, marginBottom: 40 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historyTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  exportButton: { backgroundColor: '#007BFF', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20 },
  exportText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  historyItem: { borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 10 },
  historyLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  historySub: { fontSize: 12, color: '#666', marginTop: 2 },
  noViolations: { textAlign: 'center', color: '#777', marginTop: 10 },
});
