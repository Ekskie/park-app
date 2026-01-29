import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [roleSelected, setRoleSelected] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const userId = await AsyncStorage.getItem('user_id');
        const role = await AsyncStorage.getItem('userRole');
        setLoggedIn(!!userId);
        setRoleSelected(!!role);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  if (loading) return null; // or a splash/loading screen

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {!loggedIn && <Stack.Screen name="index" />} 
      {loggedIn && !roleSelected && <Stack.Screen name="role-selection" />}
      {loggedIn && roleSelected && <Stack.Screen name="(tabs)/detect" />}
    </Stack>
  );
}
