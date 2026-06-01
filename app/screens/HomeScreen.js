// HomeScreen.js — Fixed stale data + Profile button
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { onValue, push, ref, set } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { db, GOOGLE_PLACES_API_KEY, storage } from '../firebase/config';
import LocationAutocomplete from '../../components/LocationAutocomplete';
import ErrorBoundary from '../../components/ErrorBoundary';
import { calcDistance } from '../utils/distance';
import { uploadImages } from '../utils/uploadImage';
import {
  notifyCustomerBookingConfirmed,
  notifyTechsForNewOrder,
  registerForNotifications,
} from '../utils/notifications';
import { useRouter } from 'expo-router';

const PHONE_BRANDS   = ['iPhone','Samsung','OnePlus','Redmi','Vivo','Oppo','Realme','Nokia']
const LAPTOP_BRANDS  = ['Dell','HP','Lenovo','MacBook','Asus','Acer','MSI','Sony']
const PHONE_REPAIRS  = ['Screen Replacement','Battery Replacement','Charging Port','Speaker Issue','Camera Repair','Water Damage','Back Panel','Software Issue']
const LAPTOP_REPAIRS = ['Screen Replacement','Battery Replacement','Keyboard Repair','Charging Port','RAM Upgrade','Hard Disk','Overheating','Software Issue']

// ── MapView (native only, gracefully falls back to null on web) ──
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

const TIME_SLOTS = [
  '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00',
  '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00',
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function HomeScreen() {

  // ── Generate next 14 days ──
  const generateDates = () => {
    const days = []
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    return days
  }
  const dates = generateDates()

  const getAppointmentTime = (date, slot) => {
    const startHour = parseInt(slot.split(' - ')[0].split(':')[0], 10)
    const startMin = parseInt(slot.split(' - ')[0].split(':')[1], 10)
    const t = new Date(date)
    t.setHours(startHour, startMin, 0, 0)
    return t.getTime()
  }
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
  const [images, setImages] = useState([]) // local file URIs { uri: string } before submit; download URLs from Storage after
  const [uploadingImg, setUploadingImg] = useState(false) // true while images are being uploaded to Storage
  const [submitting, setSubmitting] = useState(false)
  // ── Address & Pincode ──────────────────────────────────────────────────────
  const [addressText, setAddressText] = useState('')
  const [pincodeText, setPincodeText] = useState('')
  // ── Map Picker Modal ───────────────────────────────────────────────────────
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapLat, setMapLat] = useState(null)
  const [mapLng, setMapLng] = useState(null)
  const [reverseGeocoding, setReverseGeocoding] = useState(false)
  // ── Inline Appointment ─────────────────────────────────────────────────────
  const [wantAppointment, setWantAppointment] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)

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
    const pi = await AsyncStorage.getItem('custPincode')
    setCustName(n || 'Customer')
    setCustLocation(l || 'Your Location')
    setCustPhone(p || '')
    setAddressText(l || '')
    setPincodeText(pi || '')

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
    setImages([]) // clear stale images to prevent rendering crashes
    setDescription('')
  }

  // ── Image Picker ──
  const pickImageFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow access to your photo library to upload images.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 2,
        quality: 0.4,
      })
      if (result.canceled) return
      processSelectedImages(result.assets)
    } catch (e) {
      console.error('Image picker failed:', e)
      Alert.alert('Error', 'Could not open gallery. Try camera instead.')
    }
  }

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow camera access to take a photo of the issue.')
        return
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.4,
      })
      if (result.canceled) return
      processSelectedImages(result.assets)
    } catch (e) {
      console.error('Camera failed:', e)
      Alert.alert('Error', 'Could not open camera. Try gallery instead.')
    }
  }

  const processSelectedImages = (assets) => {
    try {
      setUploadingImg(true)
      // Store only local file URIs — upload to Firebase Storage happens at submit time
      const newImages = assets
        .filter(a => a && a.uri)
        .map(a => ({ uri: a.uri, local: true }))
      setImages(prev => {
        const combined = [...prev, ...newImages]
        return combined.slice(0, 2) // max 2 images per order
      })
    } catch (e) {
      console.error('processSelectedImages error:', e)
    } finally {
      setUploadingImg(false)
    }
  }

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

  const confirmMapLocation = async () => {
    if (!mapLat || !mapLng) return
    setReverseGeocoding(true)
    const addr = await reverseGeocode(mapLat, mapLng)
    setAddressText(addr)
    await AsyncStorage.setItem('custLocation', addr)
    setCustLocation(addr)
    setReverseGeocoding(false)
    setShowMapModal(false)
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

  const bookRepair = async (repair) => {
    try {
      const name              = await AsyncStorage.getItem('custName')     || 'Customer'
      const phone             = await AsyncStorage.getItem('custPhone')    || ''
      const customerPushToken = await AsyncStorage.getItem('pushToken')    || ''
      const loc               = addressText.trim() || (await AsyncStorage.getItem('custLocation')) || 'Your Location'
      const pincode           = pincodeText.trim() || (await AsyncStorage.getItem('custPincode')) || ''

      // Save address & pincode to AsyncStorage for future use
      await AsyncStorage.setItem('custLocation', loc)
      await AsyncStorage.setItem('custPincode', pincode)
      await AsyncStorage.setItem('lastBrand',  selectedBrand)
      await AsyncStorage.setItem('lastRepair', repair)

      // Get GPS coords to save with the order (for GPS-based technician matching)
      let orderLat = null, orderLng = null
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ timeout: 5000 })
          orderLat = pos.coords.latitude
          orderLng = pos.coords.longitude
          // Fire-and-forget GPS save (don't block submission)
          set(ref(db, 'custLocation'), { lat: orderLat, lng: orderLng }).catch(() => {})
        }
      } catch (e) {
        console.warn('GPS location failed (non-blocking):', e)
      }

      // ── Appointment data (if customer opted in) ──
      const hasAppt = wantAppointment && selectedDate && selectedSlot
      let appointmentTime = null
      if (hasAppt) {
        appointmentTime = getAppointmentTime(selectedDate, selectedSlot)
      }

      // ── Generate order ID FIRST, then upload images to Storage ──
      const tempOrderRef = push(ref(db, 'orders'))
      const orderId = tempOrderRef.key

      // Upload images to Firebase Storage (download URLs, no base64!)
      let imageUrls = null
      if (images.length > 0) {
        const localUris = images.slice(0, 2).map(img => ({ uri: img.uri }))
        imageUrls = await uploadImages(localUris, orderId)
      }

      const order = {
        customerName:       name,
        customerPhone:      phone,
        customerPushToken,
        location:           loc,
        pincode,
        brand:              selectedBrand,
        repair,
        description:        (description || '').trim(),
        images:             imageUrls, // HTTPS download URLs from Firebase Storage
        status:             'pending',
        time:               hasAppt ? selectedSlot : new Date().toLocaleTimeString(),
        custLat:            orderLat,
        custLng:            orderLng,
        ...(hasAppt && {
          isAppointment:    true,
          appointmentTime,
          date:             `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`,
          dateLabel:        `${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`,
          timeSlot:         selectedSlot,
          reminderSent:     false,
        }),
      }

      // Clear form after booking
      setDescription('')
      setImages([])
      setWantAppointment(false)
      setSelectedDate(null)
      setSelectedSlot(null)

      // Write the order (now with image download URLs)
      await set(ref(db, 'orders/' + orderId), order)
      await AsyncStorage.setItem('lastOrderId', orderId)
      await AsyncStorage.setItem('lastBrand',  selectedBrand)
      await AsyncStorage.setItem('lastRepair', repair)
      await AsyncStorage.setItem('lastCustName', name)

      // ── Local notification (fire-and-forget with safety wrapper) ──
      try {
        await notifyCustomerBookingConfirmed(selectedBrand, repair)
      } catch (notifErr) {
        console.warn('notifyCustomerBookingConfirmed failed (non-blocking):', notifErr)
      }

      // ── Free push notification to technicians (no Cloud Functions needed!) ──
      // Sends directly from customer's device via Expo Push API (free)
      notifyTechsForNewOrder(order, orderId).catch(err =>
        console.error('⚠️ notifyTechsForNewOrder failed (non-blocking):', err)
      );

      const alertMsg = hasAppt
        ? `Brand: ${selectedBrand}\nRepair: ${repair}\nDate: ${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}\nTime: ${selectedSlot}\n\nWe'll send a reminder before your appointment!`
        : `Brand: ${selectedBrand}\nRepair: ${repair}\n\nTrack your technician?`

      Alert.alert(
        hasAppt ? '✅ Appointment Booked!' : '✅ Booking Confirmed!',
        alertMsg,
        [
          { text: 'Track Now', onPress: () => router.push('/screens/TrackingScreen') },
          { text: '💬 Chat', onPress: () => router.push(`/screens/ChatScreen?orderId=${orderId}&role=cust&customerName=${encodeURIComponent(name)}&techName=`) },
          { text: 'Later' }
        ]
      )
    } catch (e) {
      console.error('bookRepair failed:', e)
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
          <TouchableOpacity style={s.avatar} onPress={() => router.push('/screens/CustomerProfileScreen')}>
            <Text style={{ fontSize: 24 }}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

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
        <ErrorBoundary key={selectedBrand || 'brand'} errorMessage="Booking form crashed. Please try again." style={{ marginHorizontal: 15 }}>
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
          <ErrorBoundary key={`imgs-${images.length}`} errorMessage="Photo upload temporarily unavailable" style={{ marginHorizontal: 0 }}>
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
                      <Image source={{ uri: img.uri || img }} style={s.imgThumb} />
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
          </ErrorBoundary>

          {/* ── Inline Appointment Toggle ── */}
          <TouchableOpacity style={s.apptToggle} onPress={() => {
            setWantAppointment(!wantAppointment)
            if (wantAppointment) { setSelectedDate(null); setSelectedSlot(null) }
          }}>
            <Text style={s.apptToggleIcon}>📅</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.apptToggleTitle}>Want to book an appointment?</Text>
              <Text style={s.apptToggleSub}>Pick a convenient date & time</Text>
            </View>
            <Text style={s.apptToggleArrow}>{wantAppointment ? '▼' : '▶'}</Text>
          </TouchableOpacity>

          {/* ── Appointment Date/Time Picker ── */}
          {wantAppointment && (
            <>
              <Text style={s.sectionTitle}>Select Date</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.dateRow}
              >
                {dates.map((d, i) => {
                  const isSel = selectedDate && d.toDateString() === selectedDate.toDateString()
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[s.dateCard, isSel && s.dateCardActive]}
                      onPress={() => { setSelectedDate(d); setSelectedSlot(null) }}
                    >
                      <Text style={[s.dateDay, isSel && s.dateDayActive]}>{DAYS[d.getDay()]}</Text>
                      <Text style={[s.dateNum, isSel && s.dateNumActive]}>{d.getDate()}</Text>
                      <Text style={[s.dateMonth, isSel && s.dateMonthActive]}>{MONTHS[d.getMonth()]}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              <Text style={s.sectionTitle}>Select Time Slot</Text>
              <View style={s.slotsGrid}>
                {TIME_SLOTS.map(slot => (
                  <TouchableOpacity
                    key={slot}
                    style={[s.slotBtn, selectedSlot === slot && s.slotBtnActive]}
                    onPress={() => setSelectedSlot(slot)}
                  >
                    <Text style={[s.slotTxt, selectedSlot === slot && s.slotTxtActive]}>🕐 {slot}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ── Your Address ── */}
          <Text style={s.sectionTitle}>📍 Your Address</Text>
          <View style={s.addressBox}>
            <ErrorBoundary errorMessage="Address search unavailable" style={{ marginHorizontal: 0 }}>
              <LocationAutocomplete
                value={addressText}
                onChangeText={(t) => {
                  setAddressText(t)
                  AsyncStorage.setItem('custLocation', t).catch(() => {})
                  setCustLocation(t)
                }}
                placeholder="Search your area..."
                icon="📍"
              />
            </ErrorBoundary>
            <TouchableOpacity style={s.mapBtn} onPress={openMapPicker}>
              <Text style={s.mapBtnIcon}>🗺️</Text>
              <Text style={s.mapBtnText}>Select on Map</Text>
            </TouchableOpacity>
            <View style={s.fieldRow}>
              <Text style={s.fieldIcon}>📮</Text>
              <TextInput
                style={s.fieldInput}
                placeholder="Enter 6-digit pincode"
                placeholderTextColor="#aaa"
                value={pincodeText}
                onChangeText={(t) => {
                  const filtered = t.replace(/[^0-9]/g, '').slice(0, 6)
                  setPincodeText(filtered)
                  AsyncStorage.setItem('custPincode', filtered).catch(() => {})
                }}
                keyboardType="numeric"
                maxLength={6}
              />
            </View>
          </View>

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
                if (submitting) return
                setSubmitting(true)
                bookRepair(desc).finally(() => setSubmitting(false))
              }}
              disabled={!description.trim() || submitting}
            >
              <Text style={s.submitBtnText}>
                {submitting ? '⏳ Submitting...' : wantAppointment && selectedDate && selectedSlot ? '📅 Book Appointment & Submit →' : '📋 Submit Repair Request'}
              </Text>
            </TouchableOpacity>
          </View>
        </ErrorBoundary>
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

  // ── Address Section ──
  addressBox:       { backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 15, marginBottom: 10, padding: 14, elevation: 2 },
  mapBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff5ee', borderWidth: 2, borderColor: '#FF6B00', borderRadius: 12, padding: 12, marginBottom: 12 },
  mapBtnIcon:       { fontSize: 18 },
  mapBtnText:       { fontSize: 13, fontWeight: '800', color: '#FF6B00' },
  fieldRow:         { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#eee', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  fieldIcon:        { fontSize: 18 },
  fieldInput:       { flex: 1, fontSize: 14, color: '#1A3A6B', fontWeight: '600' },

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

  // ── Appointment Toggle ──
  apptToggle:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', padding: 16, marginHorizontal: 15, marginBottom: 10, borderRadius: 14, elevation: 2, borderWidth: 2, borderColor: '#FF6B00' },
  apptToggleIcon:   { fontSize: 28 },
  apptToggleTitle:  { fontSize: 14, fontWeight: '800', color: '#1A3A6B' },
  apptToggleSub:    { fontSize: 11, color: '#888', marginTop: 2 },
  apptToggleArrow:  { fontSize: 18, color: '#FF6B00', fontWeight: '800' },

  // ── Date/Time Picker ──
  dateRow:          { paddingHorizontal: 15, gap: 10, paddingBottom: 5 },
  dateCard:         { width: 68, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', elevation: 2, borderWidth: 2, borderColor: 'transparent' },
  dateCardActive:   { borderColor: '#FF6B00', backgroundColor: '#fff5ee' },
  dateDay:          { fontSize: 11, fontWeight: '700', color: '#888' },
  dateDayActive:    { color: '#FF6B00' },
  dateNum:          { fontSize: 22, fontWeight: '800', color: '#1A3A6B', marginTop: 4 },
  dateNumActive:    { color: '#FF6B00' },
  dateMonth:        { fontSize: 11, fontWeight: '700', color: '#888', marginTop: 2 },
  dateMonthActive:  { color: '#FF6B00' },
  slotsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 15 },
  slotBtn:          { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', elevation: 2, borderWidth: 2, borderColor: 'transparent' },
  slotBtnActive:    { borderColor: '#FF6B00', backgroundColor: '#fff5ee' },
  slotTxt:          { fontSize: 13, fontWeight: '700', color: '#1A3A6B' },
  slotTxtActive:    { color: '#FF6B00' },

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