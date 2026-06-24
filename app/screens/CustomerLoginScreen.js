import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { ref, update } from 'firebase/database'
import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { db } from '../firebase/config'
import { registerForNotifications } from '../utils/notifications'

export default function CustomerLoginScreen() {
  const router = useRouter()

  const [step, setStep] = useState(1) // 1: Phone, 2: OTP, 3: Name
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  // ── Step 1: Send OTP ──────────────────────────────────────────────
  const sendOtp = () => {
    const cleaned = phone.replace(/[^0-9]/g, '')
    if (cleaned.length !== 10) {
      Alert.alert('Error', 'Enter a valid 10-digit phone number!')
      return
    }
    setPhone(cleaned)
    Alert.alert('📱 OTP Sent', 'Demo OTP is: 123456')
    setStep(2)
  }

  // ── Step 2: Verify OTP ────────────────────────────────────────────
  const verifyOtp = () => {
    if (otp !== '123456') {
      Alert.alert('Error', 'Invalid OTP. Use 123456')
      return
    }
    Alert.alert('✅ Verified!', 'Now set your name to continue')
    setStep(3)
  }

  // ── Step 3: Complete Login ────────────────────────────────────────
  const completeLogin = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      Alert.alert('Error', 'Please enter your name!')
      return
    }

    setLoading(true)

    try {
      await AsyncStorage.setItem('custName', trimmed)
      await AsyncStorage.setItem('custPhone', phone)

      const tokens = await registerForNotifications()
      if (tokens) {
        await AsyncStorage.setItem('pushToken', tokens.expoPushToken || '')
        if (tokens.fcmToken) {
          await AsyncStorage.setItem('fcmToken', tokens.fcmToken)
        }
        await update(ref(db, 'users/' + phone), {
          pushToken: tokens.expoPushToken || '',
          fcmToken: tokens.fcmToken || '',
          name: trimmed,
          phone,
        })
      }

      router.replace('/screens/HomeScreen')
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>

        <View style={s.header}>
          <Text style={s.icon}>🔧</Text>
          <Text style={s.title}>Welcome to DoToR</Text>
          <Text style={s.sub}>
            {step === 1 && 'Enter your phone number to get started'}
            {step === 2 && 'Enter the OTP sent to your phone'}
            {step === 3 && 'One last step — what should we call you?'}
          </Text>
        </View>

        {/* Step Indicator */}
        <View style={s.stepRow}>
          {[1, 2, 3].map(s => (
            <View
              key={s}
              style={[
                s.stepDot,
                step === s && s.stepDotActive,
                step > s && s.stepDotDone,
              ]}
            >
              <Text
                style={[
                  s.stepDotTxt,
                  (step === s || step > s) && s.stepDotTxtActive,
                ]}
              >
                {step > s ? '✓' : s}
              </Text>
            </View>
          ))}
        </View>

        {/* Step 1: Phone */}
        {step === 1 && (
          <>
            <View style={s.group}>
              <Text style={s.label}>📱 Phone Number</Text>
              <View style={s.field}>
                <Text style={s.fIcon}>🇮🇳 +91</Text>
                <TextInput
                  style={s.input}
                  placeholder="Enter 10-digit number"
                  placeholderTextColor="#aaa"
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
            </View>

            <TouchableOpacity style={s.btn} onPress={sendOtp}>
              <Text style={s.btnText}>📱 Send OTP</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Step 2: OTP */}
        {step === 2 && (
          <>
            <View style={s.phoneDisplay}>
              <Text style={s.phoneDisplayTxt}>
                📱 +91 {phone.slice(0, 5)}XXXXX
              </Text>
              <TouchableOpacity onPress={() => setStep(1)}>
                <Text style={s.changeLink}>Change</Text>
              </TouchableOpacity>
            </View>

            <View style={s.group}>
              <Text style={s.label}>🔐 OTP</Text>
              <View style={s.field}>
                <Text style={s.fIcon}>🔑</Text>
                <TextInput
                  style={[s.input, s.otpInput]}
                  placeholder="Enter OTP"
                  placeholderTextColor="#aaa"
                  value={otp}
                  onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            </View>

            <Text style={s.otpHint}>Demo OTP: <Text style={s.otpHintBold}>123456</Text></Text>

            <TouchableOpacity style={s.btn} onPress={verifyOtp}>
              <Text style={s.btnText}>✅ Verify OTP</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep(1)}>
              <Text style={s.backLink}>← Change Phone Number</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Step 3: Name */}
        {step === 3 && (
          <>
            <View style={s.namePrompt}>
              <Text style={s.namePromptIcon}>👤</Text>
            </View>

            <View style={s.group}>
              <Text style={s.label}>Your Name</Text>
              <View style={s.field}>
                <Text style={s.fIcon}>✏️</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. Rahul Kumar"
                  placeholderTextColor="#aaa"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={completeLogin}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[s.btn, loading && s.btnDisabled]}
              onPress={completeLogin}
              disabled={loading}
            >
              <Text style={s.btnText}>
                {loading ? '⏳ Logging in...' : "🚀 Let's Go!"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          onPress={() => router.push('/screens/TechLoginScreen')}
        >
          <Text style={s.switchText}>
            Are you a Technician?
            <Text style={s.link}> Login here</Text>
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 25,
  },

  back: {
    fontSize: 24,
    color: '#1A3A6B',
    fontWeight: '700',
    marginTop: 40,
    marginBottom: 10,
  },

  header: {
    alignItems: 'center',
    marginBottom: 20,
  },

  icon: {
    fontSize: 48,
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A3A6B',
    marginTop: 10,
  },

  sub: {
    fontSize: 13,
    color: '#888',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // ── Step Indicator ──
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
  },

  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepDotActive: {
    backgroundColor: '#FF6B00',
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  stepDotDone: {
    backgroundColor: '#2e7d32',
  },

  stepDotTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#bbb',
  },

  stepDotTxtActive: {
    color: '#fff',
  },

  // ── Fields ──
  group: {
    marginBottom: 18,
  },

  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A3A6B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 7,
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#eee',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },

  fIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A3A6B',
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A3A6B',
    fontWeight: '600',
  },

  otpInput: {
    fontSize: 20,
    letterSpacing: 6,
    textAlign: 'center',
  },

  // ── Phone Display ──
  phoneDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
    backgroundColor: '#f0f4ff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d0d8ee',
  },

  phoneDisplayTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A3A6B',
  },

  changeLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF6B00',
  },

  // ── OTP Hint ──
  otpHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#888',
    marginTop: -8,
    marginBottom: 18,
  },

  otpHintBold: {
    fontWeight: '800',
    color: '#1A3A6B',
    letterSpacing: 2,
  },

  // ── Name Prompt ──
  namePrompt: {
    alignItems: 'center',
    marginBottom: 10,
  },

  namePromptIcon: {
    fontSize: 56,
  },

  // ── Buttons ──
  btn: {
    backgroundColor: '#FF6B00',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 5,
  },

  btnDisabled: {
    backgroundColor: '#ccc',
  },

  btnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },

  // ── Links ──
  backLink: {
    textAlign: 'center',
    marginTop: 14,
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },

  switchText: {
    textAlign: 'center',
    marginTop: 18,
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },

  link: {
    color: '#FF6B00',
    fontWeight: '800',
  },
})
