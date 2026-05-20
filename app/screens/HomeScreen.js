// HomeScreen.js — Fixed stale data + Profile button
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { onValue, push, ref, set } from 'firebase/database';
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
  const [activeTab, setActiveTab]       = useState('home')
  const [custName, setCustName]         = useState('')
  const [custLocation, setCustLocation] = useState('')
  const [selectedDevice, setDevice]     = useState(null)
  const [brands, setBrands]             = useState([])
  const [selectedBrand, setSelectedBrand] = useState(null)
  const [repairs, setRepairs]           = useState([])
  const [myOrders, setMyOrders]         = useState([])
  const [custPhone, setCustPhone]       = useState('')

  // ── Load FRESH data every time screen is focused ──────────────────────────
  useEffect(() => {
    loadUser()
    registerForNotifications().then(token => {
      if (token) AsyncStorage.setItem('pushToken', token)
    })
  }, [])

  const loadUser = async () => {
    const n = await AsyncStorage.getItem('custName')
    const l = await AsyncStorage.getItem('custLocation')
    const p = await AsyncStorage.getItem('custPhone')
    setCustName(n || 'Customer')
    setCustLocation(l || 'Your Location')
    setCustPhone(p || '')

    // Listen for this customer's orders
    if (p) listenOrders(p)
  }

  const listenOrders = (phone) => {
    onValue(ref(db, 'orders'), snap => {
      if (!snap.exists()) { setMyOrders([]); return }
      const orders = []
      snap.forEach(child => {
        const o = { id: child.key, ...child.val() }
        if (o.customerPhone === phone) {
          orders.push(o)
        }
      })
      setMyOrders(orders.reverse())
    })
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

    try {
      const newOrderRef = await push(ref(db, 'orders'), order)
      const orderId = newOrderRef.key
      await AsyncStorage.setItem('lastOrderId', orderId)
      await AsyncStorage.setItem('lastBrand',  selectedBrand)
      await AsyncStorage.setItem('lastRepair', repair)
      await AsyncStorage.setItem('lastCustName', name)

      await notifyCustomerBookingConfirmed(selectedBrand, repair)
      Alert.alert(
        '✅ Booking Confirmed!',
        `Brand: ${selectedBrand}\nRepair: ${repair}\n\nTrack your technician?`,
        [
          { text: 'Track Now', onPress: () => router.push('/screens/TrackingScreen') },
          { text: '💬 Chat', onPress: () => router.push(`/screens/ChatScreen?orderId=${orderId}&role=cust&customerName=${encodeURIComponent(name)}`) },
          { text: 'Later' }
        ]
      )
    } catch (e) {
      Alert.alert('Error', 'Booking failed! Try again.')
    }
  }

  const WHY = [
    { icon:'🏠', title:'Doorstep Service',       desc:'Technician comes to your home!' },
    { icon:'👀', title:'Repair in Front of You', desc:'100% transparent process!' },
    { icon:'⚡', title:'Fast Service',            desc:'Arrives within 60 mins!' },
    { icon:'🛡️', title:'30 Day Warranty',         desc:'All repairs covered!' },
    { icon:'💰', title:'Best Price',              desc:'No hidden charges ever!' },
  ]

  const TABS = [
    { key: 'home',    icon: '🏠', label: 'Home' },
    { key: 'orders',  icon: '📋', label: 'Orders' },
    { key: 'profile', icon: '👤', label: 'Profile' },
  ]

  // ── HOME TAB ──
  const renderHome = () => (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Good Morning! 👋</Text>
          <Text style={s.userName}>{custName}</Text>
          <Text style={s.userLoc}>📍 {custLocation}</Text>
        </View>
        <TouchableOpacity style={s.avatar} onPress={() => router.push('/screens/CustomerProfileScreen')}>
          <Text style={{ fontSize: 24 }}>👤</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchBar}>
        <Text style={{ fontSize: 16 }}>🔍</Text>
        <TextInput style={s.searchInput} placeholder="Search repair service..." placeholderTextColor="#aaa" />
      </View>

      <TouchableOpacity style={s.banner} onPress={() => router.push('/screens/ScheduleScreen')}>
        <View>
          <Text style={s.bannerText}>🔧 Expert Repair at Your Doorstep!</Text>
          <Text style={s.bannerSub}>Book in 30 seconds!</Text>
        </View>
        <View style={s.bannerCta}>
          <Text style={s.bannerCtaTxt}>📅 Schedule</Text>
        </View>
      </TouchableOpacity>

      <Text style={s.sectionTitle}>Step 1 — Select Device</Text>
      <View style={s.deviceGrid}>
        {[['phone','📱','Phone'],['laptop','💻','Laptop']].map(([type, icon, label]) => (
          <TouchableOpacity key={type} style={[s.deviceCard, selectedDevice === type && s.deviceCardActive]} onPress={() => selectDevice(type)}>
            <Text style={s.cardIcon}>{icon}</Text>
            <Text style={s.cardName}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {brands.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Step 2 — Select Brand</Text>
          <View style={s.brandGrid}>
            {brands.map(brand => (
              <TouchableOpacity key={brand} style={[s.brandCard, selectedBrand === brand && s.brandCardActive]} onPress={() => selectBrand(brand)}>
                <Text style={s.cardIcon}>{selectedDevice === 'phone' ? '📱' : '💻'}</Text>
                <Text style={s.cardName}>{brand}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

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

      <View style={{ height: 90 }} />
    </ScrollView>
  )

  // ── ORDERS TAB ──
  const renderOrders = () => (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>📋</Text>
          <Text style={s.userName}>My Orders</Text>
          <Text style={s.userLoc}>{myOrders.length} orders total</Text>
        </View>
      </View>

      {myOrders.length === 0 ? (
        <View style={{ padding: 50, alignItems: 'center' }}>
          <Text style={{ fontSize: 50, marginBottom: 15 }}>📦</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A3A6B' }}>No orders yet</Text>
          <Text style={{ fontSize: 13, color: '#888', marginTop: 5 }}>Book your first repair and it will appear here!</Text>
        </View>
      ) : (
        myOrders.map((order, i) => {
          const statusColor = order.status === 'completed' ? '#2e7d32' : order.status === 'accepted' ? '#FF6B00' : '#888'
          const statusIcon = order.status === 'completed' ? '✅' : order.status === 'accepted' ? '🔧' : '⏳'
          return (
            <TouchableOpacity key={i} style={s.orderCard}>
              <View style={s.orderLeft}>
                <Text style={s.orderDevice}>📱 {order.brand}</Text>
                <Text style={s.orderRepair}>🔧 {order.repair}</Text>
                <Text style={s.orderLoc}>📍 {order.location}</Text>
                <Text style={s.orderTime}>🕐 {order.time}</Text>
              </View>
              <View style={s.orderRight}>
                <Text style={[s.orderStatus, { color: statusColor }]}>{statusIcon}</Text>
                <Text style={[s.orderStatusLabel, { color: statusColor }]}>{order.status}</Text>
                {order.id && (
                  <TouchableOpacity style={s.orderChatBtn} onPress={() => router.push(`/screens/ChatScreen?orderId=${order.id}&role=cust&customerName=${encodeURIComponent(custName)}&techName=${encodeURIComponent(order.techName || '')}`)}>
                    <Text style={s.orderChatTxt}>💬 Chat</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )
        })
      )}

      <View style={{ height: 90 }} />
    </ScrollView>
  )

  // ── PROFILE TAB ──
  const renderProfile = () => {
    // Navigate to profile screen when tab is selected
    setTimeout(() => {
      router.push('/screens/CustomerProfileScreen')
      setActiveTab('home') // Reset to home since we're navigating away
    }, 50)
    return null
  }

  // Show loading/blank while navigating to profile
  if (activeTab === 'profile') {
    return <View style={{ flex: 1, backgroundColor: '#f5f5f5' }} />
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {activeTab === 'home' ? renderHome() : renderOrders()}

      {/* BOTTOM TAB BAR */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tabItem, activeTab === tab.key && s.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[s.tabIcon, activeTab === tab.key && s.tabIconActive]}>{tab.icon}</Text>
            <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>{tab.label}</Text>
            {activeTab === tab.key && <View style={s.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
  banner:           { backgroundColor: '#1A3A6B', padding: 18, borderRadius: 14, marginHorizontal: 15, marginBottom: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerText:       { color: '#fff', fontSize: 15, fontWeight: '800' },
  bannerSub:        { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 3 },
  bannerCta:        { backgroundColor: '#FF6B00', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  bannerCtaTxt:     { color: '#fff', fontSize: 12, fontWeight: '800' },
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

  // ── Order Card ──
  orderCard:        { backgroundColor: '#fff', borderRadius: 14, padding: 15, marginHorizontal: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', elevation: 2, borderLeftWidth: 4, borderLeftColor: '#FF6B00' },
  orderLeft:        { flex: 1 },
  orderDevice:      { fontSize: 14, fontWeight: '800', color: '#1A3A6B' },
  orderRepair:      { fontSize: 12, color: '#FF6B00', fontWeight: '700', marginTop: 3 },
  orderLoc:         { fontSize: 11, color: '#888', marginTop: 2 },
  orderTime:        { fontSize: 11, color: '#888', marginTop: 2 },
  orderRight:       { alignItems: 'center', gap: 4 },
  orderStatus:      { fontSize: 20 },
  orderStatusLabel: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  orderChatBtn:     { backgroundColor: '#FF6B00', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 4 },
  orderChatTxt:     { color: '#fff', fontSize: 10, fontWeight: '800' },

  // ── Bottom Tab Bar ──
  tabBar:           { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#fff', paddingBottom: 25, paddingTop: 8, elevation: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  tabItem:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, position: 'relative' },
  tabItemActive:    {},
  tabIcon:          { fontSize: 22, opacity: 0.5 },
  tabIconActive:    { opacity: 1 },
  tabLabel:         { fontSize: 10, fontWeight: '600', color: '#888', marginTop: 2 },
  tabLabelActive:   { color: '#FF6B00', fontWeight: '800' },
  tabIndicator:     { position: 'absolute', top: -1, width: 30, height: 3, backgroundColor: '#FF6B00', borderRadius: 2, alignSelf: 'center' },
})