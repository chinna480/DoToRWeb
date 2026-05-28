// HomeScreen.js — Fixed stale data + Profile button
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { onValue, push, ref, set } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../firebase/config';
import { calcDistance } from '../utils/distance';
import {
  notifyCustomerBookingConfirmed,
  notifyTechsForNewOrder,
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
  const [ordersFilter, setOrdersFilter] = useState('all') // 'all', 'active', 'completed'
  const [description, setDescription] = useState('') // customer's problem description
  const [images, setImages] = useState([]) // uploaded image base64 strings
  const [uploadingImg, setUploadingImg] = useState(false)
  // ── GPS-based ETA tracking from technician ─────────────────────────────────
  const [techLat, setTechLat]       = useState(null)
  const [techLng, setTechLng]       = useState(null)
  const [custLat, setCustLat]       = useState(null)
  const [custLng, setCustLng]       = useState(null)
  const [trackingOrderId, setTrackingOrderId] = useState(null) // which accepted order we're tracking

  // ── Load FRESH data every time screen is focused ──────────────────────────
  useEffect(() => {
    loadUser()
    registerForNotifications().then(token => {
      if (token) AsyncStorage.setItem('pushToken', token)
    })
  }, [])

  // ── Listen for technician's live location when we have an accepted order ──
  useEffect(() => {
    if (!trackingOrderId) return

    // Listen for technician's GPS location
    const techUnsub = onValue(ref(db, 'techLocation'), snap => {
      if (snap.exists()) {
        setTechLat(snap.val().lat)
        setTechLng(snap.val().lng)
      }
    })

    // Also get customer's own location for distance calculation
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({})
          setCustLat(pos.coords.latitude)
          setCustLng(pos.coords.longitude)
        }
      } catch (e) {}
    })()

    return () => {
      techUnsub()
    }
  }, [trackingOrderId])

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
      let foundAccepted = false
      snap.forEach(child => {
        const o = { id: child.key, ...child.val() }
        if (o.customerPhone === phone) {
          orders.push(o)
          if (o.status === 'accepted') {
            foundAccepted = true
            setTrackingOrderId(o.id)
          }
        }
      })
      if (!foundAccepted) setTrackingOrderId(null)
      setMyOrders(orders.reverse())
    })
  }

  const selectDevice = (type) => {
    setDevice(type)
    setBrands(type === 'phone' ? PHONE_BRANDS : LAPTOP_BRANDS)
    setSelectedBrand(null)
    setRepairs([])
    setDescription('') // clear description when switching device type
  }

  const selectBrand = (brand) => {
    setSelectedBrand(brand)
    setRepairs(selectedDevice === 'phone' ? PHONE_REPAIRS : LAPTOP_REPAIRS)
  }

  // ── Image Picker ──
  const pickImageFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to upload images.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 3,
      quality: 0.5,
      base64: true,
    })
    if (result.canceled) return
    processSelectedImages(result.assets)
  }

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a photo of the issue.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      base64: true,
    })
    if (result.canceled) return
    processSelectedImages(result.assets)
  }

  const processSelectedImages = (assets) => {
    setUploadingImg(true)
    const newImages = []
    assets.forEach(asset => {
      if (asset.base64) {
        const uri = `data:image/jpeg;base64,${asset.base64}`
        newImages.push(uri)
      }
    })
    setImages(prev => {
      const combined = [...prev, ...newImages]
      return combined.slice(0, 5) // max 5 images per order
    })
    setUploadingImg(false)
  }

  const bookRepair = async (repair) => {
    const name              = await AsyncStorage.getItem('custName')     || 'Customer'
    const loc               = await AsyncStorage.getItem('custLocation') || 'Your Location'
    const pincode           = await AsyncStorage.getItem('custPincode')  || ''
    const phone             = await AsyncStorage.getItem('custPhone')    || ''
    const customerPushToken = await AsyncStorage.getItem('pushToken')    || ''

    await AsyncStorage.setItem('lastBrand',  selectedBrand)
    await AsyncStorage.setItem('lastRepair', repair)

    // Get GPS coords to save with the order (for GPS-based technician matching)
    let orderLat = null, orderLng = null
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({})
        orderLat = pos.coords.latitude
        orderLng = pos.coords.longitude
        set(ref(db, 'custLocation'), { lat: orderLat, lng: orderLng })
      }
    } catch (e) {}

    const order = {
      customerName:       name,
      customerPhone:      phone,
      customerPushToken,
      location:           loc,
      pincode,
      brand:              selectedBrand,
      repair,
      description:        description.trim(), // customer's problem description
      images:             images.length > 0 ? images : null, // uploaded photos (base64)
      status:             'pending',
      time:               new Date().toLocaleTimeString(),
      // GPS coordinates for distance-based technician matching
      custLat:            orderLat,
      custLng:            orderLng,
    }

    // Clear description and images after booking
    setDescription('')
    setImages([])

    try {
      const newOrderRef = await push(ref(db, 'orders'), order)
      const orderId = newOrderRef.key
      await AsyncStorage.setItem('lastOrderId', orderId)
      await AsyncStorage.setItem('lastBrand',  selectedBrand)
      await AsyncStorage.setItem('lastRepair', repair)
      await AsyncStorage.setItem('lastCustName', name)

      await notifyCustomerBookingConfirmed(selectedBrand, repair)

      // ── Free push notification to technicians (no Cloud Functions needed!) ──
      // Sends directly from customer's device via Expo Push API (free)
      notifyTechsForNewOrder(order, orderId).catch(err =>
        console.error('⚠️ notifyTechsForNewOrder failed (non-blocking):', err)
      );

      Alert.alert(
        '✅ Booking Confirmed!',
        `Brand: ${selectedBrand}\nRepair: ${repair}\n\nTrack your technician?`,
        [
          { text: 'Track Now', onPress: () => router.push('/screens/TrackingScreen') },
          { text: '💬 Chat', onPress: () => router.push(`/screens/ChatScreen?orderId=${orderId}&role=cust&customerName=${encodeURIComponent(name)}&techName=`) },
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={s.versionBadge}>
            <Text style={s.versionBadgeText}>OTA v1.0.0</Text>
          </View>
          <TouchableOpacity style={s.avatar} onPress={() => router.push('/screens/CustomerProfileScreen')}>
            <Text style={{ fontSize: 24 }}>👤</Text>
          </TouchableOpacity>
        </View>
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
          <Text style={s.sectionTitle}>Step 3 — Describe the Issue</Text>
          <View style={s.descBox}>
            <Text style={s.descLabel}>📝 What's the problem? (so technician knows what to bring)</Text>
            <TextInput
              style={s.descInput}
              placeholder="e.g. Screen cracked, phone not charging, battery draining fast..."
              placeholderTextColor="#aaa"
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* ── Image Upload Section ── */}
          <View style={s.sectionTitle}>📸 Upload Photos (so technician sees the issue)</View>
          <View style={s.imgUploadBox}>
            <View style={s.imgRow}>
              <TouchableOpacity style={s.imgPickerBtn} onPress={pickImageFromGallery}>
                <Text style={s.imgPickerIcon}>🖼️</Text>
                <Text style={s.imgPickerLabel}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.imgPickerBtn} onPress={takePhoto}>
                <Text style={s.imgPickerIcon}>📷</Text>
                <Text style={s.imgPickerLabel}>Camera</Text>
              </TouchableOpacity>
            </View>
            {images.length > 0 && (
              <View style={s.imgPreviewRow}>
                {images.map((img, i) => (
                  <View key={i} style={s.imgThumbWrap}>
                    <Image source={{ uri: img }} style={s.imgThumb} />
                    <TouchableOpacity
                      style={s.imgRemoveBtn}
                      onPress={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <Text style={s.imgRemoveTxt}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            {images.length > 0 && (
              <Text style={s.imgCount}>{images.length} photo{images.length > 1 ? 's' : ''} selected</Text>
            )}
            {uploadingImg && <Text style={s.uploadingTxt}>⏳ Processing...</Text>}
          </View>

          {/* ── Schedule Appointment ── */}
          <TouchableOpacity style={s.scheduleBtn} onPress={() => router.push('/screens/ScheduleScreen')}>
            <Text style={s.scheduleBtnIcon}>📅</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.scheduleBtnTitle}>Need an Appointment?</Text>
              <Text style={s.scheduleBtnSub}>Book a convenient time slot</Text>
            </View>
            <Text style={s.scheduleBtnArrow}>→</Text>
          </TouchableOpacity>

          {/* ── Submit ── */}
          <View style={s.descBox}>
            <TouchableOpacity
              style={[s.submitBtn, !description.trim() && s.submitBtnDisabled]}
              onPress={() => {
                const desc = description.trim()
                if (!desc) {
                  Alert.alert('Missing', 'Please describe your issue.')
                  return
                }
                bookRepair(desc)
              }}
              disabled={!description.trim()}
            >
              <Text style={s.submitBtnText}>📋 Submit Repair Request</Text>
            </TouchableOpacity>
          </View>
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
  const renderOrders = () => {
    // Apply filter
    let filtered = myOrders;
    if (ordersFilter === 'active') {
      filtered = myOrders.filter(o => o.status === 'pending' || o.status === 'accepted');
    } else if (ordersFilter === 'completed') {
      filtered = myOrders.filter(o => o.status === 'completed');
    }
    const activeCount = myOrders.filter(o => o.status === 'pending' || o.status === 'accepted').length;
    const completedCount = myOrders.filter(o => o.status === 'completed').length;

    const SUB_TABS = [
      { key: 'all', label: `All (${myOrders.length})` },
      { key: 'active', label: `Active (${activeCount})` },
      { key: 'completed', label: `Completed (${completedCount})` },
    ];

    return (
      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>📋</Text>
            <Text style={s.userName}>My Orders</Text>
            <Text style={s.userLoc}>{myOrders.length} orders total</Text>
          </View>
        </View>

        {/* Order Sub-Tabs */}
        <View style={s.orderSubTabs}>
          {SUB_TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.orderSubTab, ordersFilter === tab.key && s.orderSubTabActive]}
              onPress={() => setOrdersFilter(tab.key)}
            >
              <Text style={[s.orderSubTabText, ordersFilter === tab.key && s.orderSubTabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>          {filtered.length === 0 ? (
          <View style={{ padding: 50, alignItems: 'center' }}>
            <Text style={{ fontSize: 50, marginBottom: 15 }}>📦</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A3A6B' }}>No {ordersFilter === 'all' ? '' : ordersFilter} orders yet</Text>
            <Text style={{ fontSize: 13, color: '#888', marginTop: 5 }}>Book your first repair and it will appear here!</Text>
          </View>
        ) : (
          filtered.map((order, i) => {
            const statusColor = order.status === 'completed' ? '#2e7d32' : order.status === 'accepted' ? '#FF6B00' : '#888'
            const statusIcon = order.status === 'completed' ? '✅' : order.status === 'accepted' ? '🔧' : '⏳'

            // ── Calculate GPS-based ETA for accepted orders ──────────────────
            let customerEta = null
            let customerDist = null
            if (order.status === 'accepted' && techLat && techLng && custLat && custLng) {
              const d = parseFloat(calcDistance(custLat, custLng, techLat, techLng))
              const SPEED = 0.3 // km/min
              const etaMins = Math.round(d / SPEED)
              customerDist = d.toFixed(1) + ' km'
              customerEta = '~' + Math.max(1, etaMins) + ' mins'
            }

            return (
              <TouchableOpacity key={i} style={s.orderCard}>
                <View style={s.orderLeft}>
                  <Text style={s.orderDevice}>📱 {order.brand}</Text>
                  <Text style={s.orderRepair}>🔧 {order.repair}</Text>
                  <Text style={s.orderLoc}>📍 {order.location}</Text>
                  {order.pincode ? <Text style={s.orderLoc}>📮 {order.pincode}</Text> : null}
                  <Text style={s.orderTime}>🕐 {order.time}</Text>
                  {/* Show technician name for accepted orders */}
                  {order.status === 'accepted' && order.techName && (
                    <Text style={s.orderTech}>🛵 {order.techName} is coming!</Text>
                  )}
                  {/* GPS-based ETA display for accepted orders */}
                  {order.status === 'accepted' && customerDist && (
                    <View style={s.custEtaRow}>
                      <Text style={s.custEtaText}>📍 {customerDist} away</Text>
                      <Text style={s.custEtaBadge}>{customerEta}</Text>
                    </View>
                  )}
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
  }

  // Show loading/blank while navigating to profile
  if (activeTab === 'profile') {
    // Navigate to profile screen when tab is selected
    setTimeout(() => {
      router.push('/screens/CustomerProfileScreen')
      setActiveTab('home') // Reset to home since we're navigating away
    }, 50)
    return <View style={{ flex: 1, backgroundColor: '#f5f5f5' }} />
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {activeTab === 'home' && renderHome()}
      {activeTab === 'orders' && renderOrders()}

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
  versionBadge:     { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  versionBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
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

  // ── Description Input ──
  descBox:          { backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 15, marginBottom: 10, padding: 14, elevation: 2 },
  descLabel:        { fontSize: 12, fontWeight: '700', color: '#1A3A6B', marginBottom: 8 },
  descInput:        { backgroundColor: '#f8f8f8', borderRadius: 10, padding: 12, fontSize: 13, color: '#333', minHeight: 80, textAlignVertical: 'top' },

  // ── Image Upload ──
  imgUploadBox:     { backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 15, marginBottom: 10, padding: 14, elevation: 2 },
  imgRow:           { flexDirection: 'row', gap: 12 },
  imgPickerBtn:     { flex: 1, backgroundColor: '#f8f8f8', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: '#eee', borderStyle: 'dashed' },
  imgPickerIcon:    { fontSize: 28 },
  imgPickerLabel:   { fontSize: 12, fontWeight: '800', color: '#1A3A6B', marginTop: 4 },
  imgPreviewRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  imgThumbWrap:     { position: 'relative' },
  imgThumb:         { width: 80, height: 80, borderRadius: 10, backgroundColor: '#eee' },
  imgRemoveBtn:     { position: 'absolute', top: -6, right: -6, backgroundColor: '#c62828', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  imgRemoveTxt:     { color: '#fff', fontSize: 11, fontWeight: '800' },
  imgCount:         { fontSize: 12, color: '#888', fontWeight: '600', marginTop: 8, textAlign: 'center' },
  uploadingTxt:     { fontSize: 12, color: '#FF6B00', fontWeight: '700', marginTop: 8, textAlign: 'center' },
  orderTech:        { fontSize: 12, fontWeight: '700', color: '#FF6B00', marginTop: 4 },
  custEtaRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  custEtaText:      { fontSize: 11, fontWeight: '700', color: '#2e7d32' },
  custEtaBadge:     { fontSize: 10, fontWeight: '800', color: '#fff', backgroundColor: '#FF6B00', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },

  // ── Schedule Button ──
  scheduleBtn:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', padding: 16, marginHorizontal: 15, marginBottom: 14, borderRadius: 14, elevation: 2, borderWidth: 2, borderColor: '#1A3A6B' },
  scheduleBtnIcon:  { fontSize: 28 },
  scheduleBtnTitle: { fontSize: 14, fontWeight: '800', color: '#1A3A6B' },
  scheduleBtnSub:   { fontSize: 11, color: '#888', marginTop: 2 },
  scheduleBtnArrow: { fontSize: 22, color: '#1A3A6B', fontWeight: '800' },

  // ── Submit Button ──
  submitBtn:        { backgroundColor: '#FF6B00', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 14, elevation: 3 },
  submitBtnDisabled:{ backgroundColor: '#ccc', elevation: 0 },
  submitBtnText:    { color: '#fff', fontSize: 15, fontWeight: '800' },

  // ── Order Sub-Tabs ──
  orderSubTabs:     { flexDirection: 'row', marginHorizontal: 15, marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 2 },
  orderSubTab:      { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  orderSubTabActive:{ borderBottomColor: '#FF6B00' },
  orderSubTabText:  { fontSize: 11, fontWeight: '700', color: '#888' },
  orderSubTabTextActive: { color: '#FF6B00', fontWeight: '800' },

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