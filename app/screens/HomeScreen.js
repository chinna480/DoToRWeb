// HomeScreen.js — Fixed stale data + Profile button
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { push, ref, set } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../firebase/config';
import {
  notifyCustomerBookingConfirmed,
  registerForNotifications,
} from '../utils/notifications';

const PHONE_BRANDS   = ['iPhone','Samsung','OnePlus','Redmi','Vivo','Oppo','Realme','Nokia']
const LAPTOP_BRANDS  = ['Dell','HP','Lenovo','MacBook','Asus','Acer','MSI','Sony']
const PHONE_REPAIRS  = ['Screen Replacement','Battery Replacement','Charging Port','Speaker Issue','Camera Repair','Water Damage','Back Panel','Software Issue']
const LAPTOP_REPAIRS = ['Screen Replacement','Battery Replacement','Keyboard Repair','Charging Port','RAM Upgrade','Hard Disk','Overheating','Software Issue']

import { useRouter } from 'expo-router';
export default function HomeScreen() {
  const router = useRouter();
  const [custName, setCustName]           = useState('')
  const [custLocation, setCustLocation]   = useState('')
  const [selectedDevice, setDevice]       = useState(null)
  const [brands, setBrands]               = useState([])
  const [selectedBrand, setSelectedBrand] = useState(null)
  const [repairs, setRepairs]             = useState([])

  // ── Load FRESH data every time screen is focused ──────────────────────────
  useEffect(() => {
    loadUser()
    registerForNotifications().then(token => {
      if (token) AsyncStorage.setItem('pushToken', token)
    })
  }, [])

  const loadUser = async () => {
    // Always read fresh — no defaults here to avoid showing stale data
    const n = await AsyncStorage.getItem('custName')
    const l = await AsyncStorage.getItem('custLocation')
    setCustName(n || 'Customer')
    setCustLocation(l || 'Your Location')
  }

  const selectDevice = (type) => {
    setDevice(type)
    setBrands(type === 'phone' ? PHONE_BRANDS : LAPTOP_BRANDS)
    setSelectedBrand(null)
    setRepairs([])
  }

  const selectBrand = (brand) => {
    setSelectedBrand(brand)
    setRepairs(selectedDevice === 'phone' ? PHONE_REPAIRS : LAPTOP_REPAIRS)
  }

  const bookRepair = async (repair) => {
    // Always fetch FRESH data from AsyncStorage at booking time
    const name              = await AsyncStorage.getItem('custName')     || 'Customer'
    const loc               = await AsyncStorage.getItem('custLocation') || 'Your Location'
    const phone             = await AsyncStorage.getItem('custPhone')    || ''
    const customerPushToken = await AsyncStorage.getItem('pushToken')    || ''

    await AsyncStorage.setItem('lastBrand',  selectedBrand)
    await AsyncStorage.setItem('lastRepair', repair)

    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({})
        set(ref(db, 'custLocation'), { lat: pos.coords.latitude, lng: pos.coords.longitude })
      }
    } catch (e) {}

    const order = {
      customerName:       name,
      customerPhone:      phone,
      customerPushToken,
      location:           loc,
      brand:              selectedBrand,
      repair,
      status:             'pending',
      time:               new Date().toLocaleTimeString(),
    }

    push(ref(db, 'orders'), order)
      .then(async () => {
        await notifyCustomerBookingConfirmed(selectedBrand, repair)
        Alert.alert(
          '✅ Booking Confirmed!',
          `Brand: ${selectedBrand}\nRepair: ${repair}\n\nTrack your technician?`,
          [
            { text: 'Track Now', onPress: () => router.push('/screens/TrackingScreen') },
            { text: 'Later' }
          ]
        )
      })
      .catch(() => Alert.alert('Error', 'Booking failed! Try again.'))
  }

  const WHY = [
    { icon:'🏠', title:'Doorstep Service',       desc:'Technician comes to your home!' },
    { icon:'👀', title:'Repair in Front of You', desc:'100% transparent process!' },
    { icon:'⚡', title:'Fast Service',            desc:'Arrives within 60 mins!' },
    { icon:'🛡️', title:'30 Day Warranty',         desc:'All repairs covered!' },
    { icon:'💰', title:'Best Price',              desc:'No hidden charges ever!' },
  ]

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>

      {/* HEADER */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Good Morning! 👋</Text>
          <Text style={s.userName}>{custName}</Text>
          <Text style={s.userLoc}>📍 {custLocation}</Text>
        </View>
        {/* Profile Button */}
        <TouchableOpacity
          style={s.avatar}
          onPress={() => router.push('/screens/CustomerProfileScreen')}
        >
          <Text style={{ fontSize: 24 }}>👤</Text>
        </TouchableOpacity>
      </View>

      {/* SEARCH */}
      <View style={s.searchBar}>
        <Text style={{ fontSize: 16 }}>🔍</Text>
        <TextInput style={s.searchInput} placeholder="Search repair service..." placeholderTextColor="#aaa" />
      </View>

      {/* BANNER */}
      <View style={s.banner}>
        <Text style={s.bannerText}>🔧 Expert Repair at Your Doorstep!</Text>
        <Text style={s.bannerSub}>Book in 30 seconds!</Text>
      </View>

      {/* STEP 1 */}
      <Text style={s.sectionTitle}>Step 1 — Select Device</Text>
      <View style={s.deviceGrid}>
        {[['phone','📱','Phone'],['laptop','💻','Laptop']].map(([type, icon, label]) => (
          <TouchableOpacity
            key={type}
            style={[s.deviceCard, selectedDevice === type && s.deviceCardActive]}
            onPress={() => selectDevice(type)}
          >
            <Text style={s.cardIcon}>{icon}</Text>
            <Text style={s.cardName}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* STEP 2 */}
      {brands.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Step 2 — Select Brand</Text>
          <View style={s.brandGrid}>
            {brands.map(brand => (
              <TouchableOpacity
                key={brand}
                style={[s.brandCard, selectedBrand === brand && s.brandCardActive]}
                onPress={() => selectBrand(brand)}
              >
                <Text style={s.cardIcon}>{selectedDevice === 'phone' ? '📱' : '💻'}</Text>
                <Text style={s.cardName}>{brand}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* STEP 3 */}
      {repairs.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Step 3 — What needs Repair?</Text>
          {repairs.map(repair => (
            <TouchableOpacity key={repair} style={s.repairItem} onPress={() => bookRepair(repair)}>
              <Text style={s.repairText}>🔧 {repair}</Text>
              <Text style={s.arrow}>→</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* WHY DOTOR */}
      <Text style={s.sectionTitle}>⭐ Why DoToR?</Text>
      {WHY.map((item, i) => (
        <View key={i} style={s.whyItem}>
          <Text style={s.whyIcon}>{item.icon}</Text>
          <View>
            <Text style={s.whyTitle}>{item.title}</Text>
            <Text style={s.whyDesc}>{item.desc}</Text>
          </View>
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f5f5f5' },
  header:           { backgroundColor: '#FF6B00', padding: 20, paddingTop: 55, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting:         { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  userName:         { fontSize: 20, color: '#fff', fontWeight: '800' },
  userLoc:          { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  avatar:           { width: 50, height: 50, backgroundColor: '#fff', borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  searchBar:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 12, borderRadius: 14, margin: 15, elevation: 3 },
  searchInput:      { flex: 1, fontSize: 13, color: '#333' },
  banner:           { backgroundColor: '#1A3A6B', padding: 18, borderRadius: 14, marginHorizontal: 15, marginBottom: 5 },
  bannerText:       { color: '#fff', fontSize: 15, fontWeight: '800' },
  bannerSub:        { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 3 },
  sectionTitle:     { fontSize: 16, fontWeight: '800', color: '#1A3A6B', marginHorizontal: 15, marginTop: 20, marginBottom: 12 },
  deviceGrid:       { flexDirection: 'row', gap: 12, marginHorizontal: 15 },
  deviceCard:       { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 22, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', elevation: 3 },
  deviceCardActive: { borderColor: '#FF6B00' },
  brandGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 15 },
  brandCard:        { width: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2, borderWidth: 2, borderColor: 'transparent' },
  brandCardActive:  { borderColor: '#FF6B00' },
  cardIcon:         { fontSize: 30 },
  cardName:         { fontSize: 12, fontWeight: '800', color: '#1A3A6B', marginTop: 5, textAlign: 'center' },
  repairItem:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, marginHorizontal: 15, marginBottom: 10, borderRadius: 12, elevation: 2 },
  repairText:       { fontSize: 13, fontWeight: '700', color: '#1A3A6B' },
  arrow:            { fontSize: 18, color: '#FF6B00', fontWeight: '800' },
  whyItem:          { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', padding: 14, marginHorizontal: 15, marginBottom: 10, borderRadius: 14, elevation: 2 },
  whyIcon:          { fontSize: 28 },
  whyTitle:         { fontSize: 13, fontWeight: '800', color: '#1A3A6B' },
  whyDesc:          { fontSize: 11, color: '#888', marginTop: 2 },
})