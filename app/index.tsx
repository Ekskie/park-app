import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AuthScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('');
  const [login, setLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  // Check if user is already logged in
  const checkLoginStatus = useCallback(async () => {
    try {
      const storedEmail = await AsyncStorage.getItem('userEmail');
      if (storedEmail) {
        router.replace('/(tabs)/detect'); // redirect logged-in users
      }
    } catch (error) {
      console.error('Error checking login status:', error);
    }
  }, [router]);

  useEffect(() => {
    checkLoginStatus();
  }, [checkLoginStatus]);

  // Handle login or signup
  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      return Alert.alert('Error', 'Please enter a valid email and password');
    }

    if (!login) {
      if (password !== repeatPassword) {
        return Alert.alert('Error', 'Passwords do not match');
      } if (!userName) {
        return Alert.alert('Error', 'Give a valid name');
      }
    }

    setLoading(true);

    try {
      if (login) {
        let { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        })
        setUserId(data.user?.id || null)
        await AsyncStorage.setItem('user_id', data.user?.id || '');
        console.log(data)

        if(data.session) {
          router.replace('/(tabs)/detect');
        }

        if (error) {
          setError(error.message)
        }
      }
     else {
      // 1️⃣ Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      const newUserId = data.user?.id;
      if (!newUserId) throw new Error('Failed to get user ID');

      setUserId(newUserId);

      // 2️⃣ Insert profile with user ID and name
      const { data: profileData, error: profileError } = await supabase
        .from('profile')
        .insert([{ id: newUserId, name: userName }])
        .select();

      if (profileError) throw profileError;

      console.log('Profile created:', profileData);

      // 3️⃣ Save user ID locally
      await AsyncStorage.setItem('user_id', newUserId);


      router.replace('./role-selection');

      return; // stop further navigation
    }

    } catch (error: any) {
      console.error('Auth error:', error);
      Alert.alert('Error', error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../assets/images/icon.png')} style={styles.logo} />
      <Text style={styles.subtitle}>Welcome to ParkAlert</Text>

      <View style={styles.content}>
        {!login &&
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={userName}
          onChangeText={setUserName}
        />
        }
        <TextInput
          style={styles.input}
          placeholder="example@email.com"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {!login && (
          <TextInput
            style={styles.input}
            placeholder="Repeat Password"
            value={repeatPassword}
            onChangeText={setRepeatPassword}
            secureTextEntry
          />
        )}
        <Text style={styles.error}>{error}</Text>
        <Text>
          {login ? "Don't have an account? " : 'Already have an account? '}
          <Text
            style={{ color: 'blue' }}
            onPress={() => {
              setLogin(!login)
              setError('')
            }}
          >
            {login ? 'Sign Up' : 'Login'}
          </Text>
        </Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleAuth}>
        <Text style={{color:'white'}}>{loading ? 'Please wait...' : login ? 'Login' : 'Sign Up'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(40, 76, 197, 0.1)',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  content: {
    width: '100%',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000000ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
    alignSelf: 'center',
    overflow: 'hidden',
    transform: [{ translateY: -40 }],
  },
  error: {
    fontSize: 12,
    color: 'red',
    paddingBlock: 8,
    textAlign: 'center'
  },
  button: {
    backgroundColor: '#007BFF',
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBlock:16
  }
});
