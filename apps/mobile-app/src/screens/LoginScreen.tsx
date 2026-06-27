import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuthStore } from '../store/authStore';

type Mode = 'email' | 'phone';
type PhasePhone = 'enter_phone' | 'enter_otp';

export const LoginScreen: React.FC = () => {
  const { login, loginWithPhone } = useAuthStore();
  const [mode, setMode] = useState<Mode>('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phonePhase, setPhonePhase] = useState<PhasePhone>('enter_phone');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch {
      Alert.alert('Login Failed', 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOTP = async () => {
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    setLoading(true);
    try {
      const { authAPI } = require('../api/auth');
      await authAPI.requestOTP(phone.trim());
      setPhonePhase('enter_otp');
    } catch {
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPLogin = async () => {
    if (!otp.trim()) {
      Alert.alert('Error', 'Please enter the OTP');
      return;
    }
    setLoading(true);
    try {
      await loginWithPhone(phone.trim(), otp.trim());
    } catch {
      Alert.alert('Login Failed', 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>🛍</Text>
        <Text style={styles.title}>QuantiByte Loyalty</Text>
        <Text style={styles.subtitle}>Earn points, unlock rewards</Text>
      </View>

      <View style={styles.card}>
        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'phone' && styles.modeBtnActive]}
            onPress={() => { setMode('phone'); setPhonePhase('enter_phone'); }}
          >
            <Text style={[styles.modeBtnText, mode === 'phone' && styles.modeBtnTextActive]}>
              Phone
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'email' && styles.modeBtnActive]}
            onPress={() => setMode('email')}
          >
            <Text style={[styles.modeBtnText, mode === 'email' && styles.modeBtnTextActive]}>
              Email
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'email' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={styles.button}
              onPress={handleEmailLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </>
        ) : phonePhase === 'enter_phone' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <TouchableOpacity
              style={styles.button}
              onPress={handleRequestOTP}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.otpHint}>OTP sent to {phone}</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter OTP"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={styles.button}
              onPress={handleOTPLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify & Sign In</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPhonePhase('enter_phone')}>
              <Text style={styles.link}>Change number</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 56,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 12,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
  },
  modeBtnTextActive: {
    color: '#1e40af',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  otpHint: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
  },
  link: {
    textAlign: 'center',
    color: '#2563eb',
    fontSize: 14,
    marginTop: 4,
  },
});