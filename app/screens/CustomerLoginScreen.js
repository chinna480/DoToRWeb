import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'

import { ref, update } from 'firebase/database'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import * as Location from 'expo-location'
import { db, GOOGLE_PLACES_API_KEY } from '../firebase/config'
import { registerForNotifications } from '../utils/notifications'
import LocationAutocomplete from '../../components/LocationAutocomplete'

// ── MapView (native only, graceful fallback on web) ──
let MapView = null, MarkerNative = null
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps')
    MapView = Maps.default
    MarkerNative = Maps.Marker
  } catch (e) {
    MapView = null
  }
}

export default function CustomerLoginScreen() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [pincode, setPincode] = useState('')
  const [aadharVerified, setAadharVerified] = useState(false)
  const [aadharName, setAadharName] = useState('')
  // ── Map Picker ──
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapLat, setMapLat] = useState(null)
  const [mapLng, setMapLng] = useState(null)
  const [reverseGeocoding, setReverseGeocoding] = useState(false)

  const [otp, setOtp] = useState('')
  const [showOtpBox, setShowOtpBox] = useState(false)

  const params = useLocalSearchParams()

  useFocusEffect(
    useCallback(() => {
      const syncVerification = async () => {
        if (params.aadharVerified === 'true') {
          setAadharVerified(true)
          setAadharName(params.aadharName || 'Verified')
          return
        }

        // Fallback: check AsyncStorage (used when coming back from DigiLockerScreen)
        const storedVerified = await AsyncStorage.getItem('digilockerVerified')
        if (storedVerified === 'true') {
          setAadharVerified(true)
          const storedName = await AsyncStorage.getItem('digilockerName')
          if (storedName) setAadharName(storedName)
        }
      }
      syncVerification()
    }, [params.aadharVerified])
  )

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

    if (!/^\d{6}$/.test(pincode)) {
      Alert.alert('Error', 'Enter a valid 6-digit pincode!')
      return
    }

    if (!aadharVerified) {
      Alert.alert('Error', 'Please verify your Aadhar via DigiLocker first!')
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
  await AsyncStorage.setItem('custPincode', pincode)

  const token = await registerForNotifications()
  if (token) {
    await AsyncStorage.setItem('pushToken', token)
    // ← THIS LINE saves to Firebase under users/
    await update(ref(db, 'users/' + phone), { 
      pushToken: token, 
      name, 
      phone, 
      location,
      pincode
    })
  }

  router.replace('/screens/HomeScreen')
}

  // ── Map Picker Functions ──
  const reverseGeocode = async (lat, lng) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_PLACES_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.status === 'OK' && data.results.length > 0) {
        return data.results[0].formatted_address
      }
    } catch (e) {}
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }

  const openMapPicker = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({})
        setMapLat(pos.coords.latitude)
        setMapLng(pos.coords.longitude)
      } else {
        setMapLat(17.3850)
        setMapLng(78.4867)
      }
    } catch (e) {
      setMapLat(17.3850)
      setMapLng(78.4867)
    }
    setShowMapModal(true)
  }

  const confirmMapLocation = async () => {
    if (!mapLat || !mapLng) return
    setReverseGeocoding(true)
    const addr = await reverseGeocode(mapLat, mapLng)
    setLocation(addr)
    await AsyncStorage.setItem('custLocation', addr)
    setReverseGeocoding(false)
    setShowMapModal(false)
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

        {/* ── Your Address with Autocomplete + Map Picker ── */}
        <View style={s.group}>
          <Text style={s.label}>📍 Your Address</Text>
          <View style={s.addressBox}>
            <LocationAutocomplete
              value={location}
              onChangeText={(t) => {
                setLocation(t)
                AsyncStorage.setItem('custLocation', t).catch(() => {})
              }}
              placeholder="Search your area..."
              icon="📍"
            />
            <TouchableOpacity style={s.mapBtn} onPress={openMapPicker}>
              <Text style={s.mapBtnIcon}>🗺️</Text>
              <Text style={s.mapBtnText}>Select on Map</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Field
          label="Pincode"
          icon="📮"
          placeholder="Enter 6-digit pincode"
          value={pincode}
          onChange={(t) => setPincode(t.replace(/[^0-9]/g, '').slice(0, 6))}
          type="numeric"
          max={6}
        />

        {/* DIGILOCKER AADHAR VERIFICATION */}
        <View style={s.group}>
          <Text style={s.label}>Aadhar Verification</Text>
          <TouchableOpacity
            style={[s.digiBtn, aadharVerified && s.digiBtnDone]}
            onPress={() => {
              if (!aadharVerified) {
                router.push({
                  pathname: '/screens/DigiLockerScreen',
                  params: { onVerified: 'customer' }
                })
              }
            }}
          >
            <Text style={s.digiIcon}>🏛️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.digiTxt, aadharVerified && s.digiTxtDone]}>
                {aadharVerified
                  ? `✅ Aadhar Verified — ${aadharName}`
                  : 'Verify Aadhar via DigiLocker'}
              </Text>
              <Text style={s.digiSub}>
                {aadharVerified
                  ? 'Identity confirmed by Government'
                  : 'Secure government verification'}
              </Text>
            </View>
            {!aadharVerified && <Text style={s.digiArrow}>→</Text>}
          </TouchableOpacity>
        </View>

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

      {/* ── Map Picker Modal ── */}
      <Modal visible={showMapModal} animationType="slide" transparent={false}>
        <View style={s.mapModalContainer}>
          <View style={s.mapModalHeader}>
            <Text style={s.mapModalTitle}>📍 Select Your Location</Text>
            <TouchableOpacity onPress={() => setShowMapModal(false)}>
              <Text style={s.mapModalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          {mapLat && mapLng && MapView ? (
            <MapView
              style={{ flex: 1 }}
              initialRegion={{
                latitude: mapLat,
                longitude: mapLng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={(e) => {
                setMapLat(e.nativeEvent.coordinate.latitude)
                setMapLng(e.nativeEvent.coordinate.longitude)
              }}
            >
              {MarkerNative && (
                <MarkerNative
                  coordinate={{ latitude: mapLat, longitude: mapLng }}
                  draggable
                  onDragEnd={(e) => {
                    setMapLat(e.nativeEvent.coordinate.latitude)
                    setMapLng(e.nativeEvent.coordinate.longitude)
                  }}
                  title="Your Location"
                />
              )}
            </MapView>
          ) : (
            <View style={s.mapModalPlaceholder}>
              <Text style={s.mapModalPlaceholderIcon}>🗺️</Text>
              <Text style={s.mapModalPlaceholderText}>{MapView ? 'Loading map...' : 'Map is not available on web'}</Text>
            </View>
          )}
          <View style={s.mapModalFooter}>
            <Text style={s.mapModalHint}>Tap on the map or drag the pin to set your exact location</Text>
            <TouchableOpacity
              style={s.mapModalConfirmBtn}
              onPress={confirmMapLocation}
              disabled={reverseGeocoding}
            >
              {reverseGeocoding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.mapModalConfirmText}>✅ Confirm Location</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  },
  // ── Address Box ──
  addressBox:       { backgroundColor: '#fff', borderRadius: 14, padding: 14, elevation: 2, borderWidth: 2, borderColor: '#eee' },
  mapBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff5ee', borderWidth: 2, borderColor: '#FF6B00', borderRadius: 12, padding: 12, marginTop: 12 },
  mapBtnIcon:       { fontSize: 18 },
  mapBtnText:       { fontSize: 13, fontWeight: '800', color: '#FF6B00' },

  // ── Map Modal ──
  mapModalContainer:    { flex: 1, backgroundColor: '#fff' },
  mapModalHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 55, paddingBottom: 15, backgroundColor: '#FF6B00' },
  mapModalTitle:        { fontSize: 17, fontWeight: '800', color: '#fff' },
  mapModalClose:        { fontSize: 22, color: '#fff', fontWeight: '800', padding: 4 },
  mapModalPlaceholder:  { flex: 1, backgroundColor: '#1A3A6B', alignItems: 'center', justifyContent: 'center' },
  mapModalPlaceholderIcon: { fontSize: 50 },
  mapModalPlaceholderText: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 10 },
  mapModalFooter:       { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  mapModalHint:         { fontSize: 12, color: '#888', fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  mapModalConfirmBtn:   { backgroundColor: '#FF6B00', padding: 16, borderRadius: 14, alignItems: 'center', elevation: 3 },
  mapModalConfirmText:  { color: '#fff', fontSize: 16, fontWeight: '800' },

  digiBtn:     { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#1A3A6B', borderRadius: 12, padding: 14, gap: 12, backgroundColor: '#f0f4ff' },
  digiBtnDone: { borderColor: '#2e7d32', backgroundColor: '#f1f8f1' },
  digiIcon:    { fontSize: 28 },
  digiTxt:     { fontSize: 14, fontWeight: '800', color: '#1A3A6B' },
  digiTxtDone: { color: '#2e7d32' },
  digiSub:     { fontSize: 11, color: '#888', marginTop: 2 },
  digiArrow:   { fontSize: 18, color: '#1A3A6B', fontWeight: '800' },
})