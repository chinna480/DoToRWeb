import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useState } from 'react'

import { ref, update } from 'firebase/database'
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

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')

  const [otp, setOtp] = useState('')
  const [showOtpBox, setShowOtpBox] = useState(false)

  const sendOtp = () => {
    if (!name) {
      Alert.alert('Error', 'Enter your name!')
      return
    }

    if (!email) {
      Alert.alert('Error', 'Enter your email!')
      return
    }

    if (phone.length !== 10) {
      Alert.alert('Error', 'Enter valid 10 digit number!')
      return
    }

    if (!location) {
      Alert.alert('Error', 'Enter your location!')
      return
    }

    setShowOtpBox(true)

    Alert.alert(
      'OTP Sent',
      'Demo OTP is: 123456'
    )
  }

 const verifyOtp = async () => {
  if (otp !== '123456') {
    Alert.alert('Error', 'Invalid OTP')
    return
  }

  await AsyncStorage.setItem('custName', name)
  await AsyncStorage.setItem('custEmail', email)
  await AsyncStorage.setItem('custPhone', phone)
  await AsyncStorage.setItem('custLocation', location)

  const token = await registerForNotifications()
  if (token) {
    await AsyncStorage.setItem('pushToken', token)
    // ← THIS LINE saves to Firebase under users/
    await update(ref(db, 'users/' + phone), { 
      pushToken: token, 
      name, 
      phone, 
      location 
    })
  }

  router.replace('/screens/HomeScreen')
}

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={s.container}>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>

        <View style={s.header}>
          <Text style={s.icon}>👤</Text>
          <Text style={s.title}>Customer Login</Text>
          <Text style={s.sub}>Enter your details to continue</Text>
        </View>

        <Field
          label="Full Name"
          icon="👤"
          placeholder="Enter your full name"
          value={name}
          onChange={setName}
          type="default"
        />

        <Field
          label="Email ID"
          icon="📧"
          placeholder="Enter your email"
          value={email}
          onChange={setEmail}
          type="email-address"
        />

        <Field
          label="Phone Number"
          icon="📱"
          placeholder="Enter 10 digit number"
          value={phone}
          onChange={setPhone}
          type="numeric"
          max={10}
        />

        <Field
          label="Your Location"
          icon="📍"
          placeholder="Enter your area"
          value={location}
          onChange={setLocation}
          type="default"
        />

        {!showOtpBox ? (
          <TouchableOpacity style={s.btn} onPress={sendOtp}>
            <Text style={s.btnText}>Send OTP →</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Field
              label="OTP"
              icon="🔐"
              placeholder="Enter OTP"
              value={otp}
              onChange={setOtp}
              type="numeric"
              max={6}
            />

            <TouchableOpacity style={s.btn} onPress={verifyOtp}>
              <Text style={s.btnText}>Verify OTP →</Text>
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

function Field({
  label,
  icon,
  placeholder,
  value,
  onChange,
  type,
  max
}) {
  return (
    <View style={s.group}>
      <Text style={s.label}>{label}</Text>

      <View style={s.field}>
        <Text style={s.fIcon}>{icon}</Text>

        <TextInput
          style={s.input}
          placeholder={placeholder}
          placeholderTextColor="#aaa"
          value={value}
          onChangeText={onChange}
          keyboardType={type}
          maxLength={max}
        />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 25
  },

  back: {
    fontSize: 24,
    color: '#1A3A6B',
    fontWeight: '700',
    marginTop: 40,
    marginBottom: 10
  },

  header: {
    alignItems: 'center',
    marginBottom: 25
  },

  icon: {
    fontSize: 45
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A3A6B',
    marginTop: 10
  },

  sub: {
    fontSize: 13,
    color: '#888',
    marginTop: 5
  },

  group: {
    marginBottom: 16
  },

  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A3A6B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 7
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#eee',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10
  },

  fIcon: {
    fontSize: 18
  },

  input: {
    flex: 1,
    fontSize: 14,
    color: '#1A3A6B',
    fontWeight: '600'
  },

  btn: {
    backgroundColor: '#FF6B00',
    padding: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 5
  },

  btnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff'
  },

  switchText: {
    textAlign: 'center',
    marginTop: 18,
    color: '#888',
    fontSize: 13,
    fontWeight: '600'
  },

  link: {
    color: '#FF6B00',
    fontWeight: '800'
  }
})