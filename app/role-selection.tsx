import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RoleSelection() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedRole) return Alert.alert('Error', 'Please select a role');

    try {
      // Get userId asynchronously
      const userId = await AsyncStorage.getItem('user_id');
      if (!userId) throw new Error('User not found');

      const { data, error } = await supabase
        .from('profile')
        .update({ role: selectedRole.toLowerCase() })
        .eq('id', userId)
        .select();

      if (error) throw error;

      // Save role locally
      await AsyncStorage.setItem('userRole', selectedRole);

      // Navigate to detect tab
      router.replace('/(tabs)/detect');
    } catch (err: any) {
      console.error('Error updating role:', err);
      Alert.alert('Error', err.message || 'Failed to update role');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your Role</Text>
      {['Admin', 'Driver', 'Resident'].map((role) => (
        <TouchableOpacity
          key={role}
          style={[
            styles.button,
            selectedRole === role && styles.selectedButton,
          ]}
          onPress={() => setSelectedRole(role)}
        >
          <Text
            style={[
              styles.buttonText,
              selectedRole === role && styles.selectedButtonText,
            ]}
          >
            {role}
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 20, marginBottom: 20, fontWeight: '600' },
  button: {
    borderWidth: 1,
    borderColor: '#007BFF',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    width: '60%',
    alignItems: 'center',
  },
  selectedButton: { backgroundColor: '#007BFF' },
  buttonText: { fontSize: 16, color: '#007BFF' },
  selectedButtonText: { color: '#fff' },
  submitButton: { marginTop: 30, padding: 14, backgroundColor: '#28a745', borderRadius: 50 },
  submitButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
