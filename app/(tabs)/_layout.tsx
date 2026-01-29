import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Button } from 'react-native';

export default function TabsLayout() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userEmail');
      await AsyncStorage.removeItem('userId');

      router.replace('/');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to logout: ' + err.message);
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerRight: () => <Button title="Logout" onPress={handleLogout} />,
      }}
    >
      <Tabs.Screen name="detect" options={{ title: 'Park Alert' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>

  );
}