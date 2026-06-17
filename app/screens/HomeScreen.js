// HomeScreen.js — 8-Step Booking Wizard + Orders + Profile
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { onValue, push, ref } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../firebase/config';
import {
  notifyCustomerBookingConfirmed,
  notifyTechsForNewOrder,
  registerForNotifications,
} from '../utils/notifications';
import { uploadImages, uploadVideos } from '../utils/uploadImage';
import { Video, ResizeMode } from 'expo-av';
import MapPickerModal from '../../components/MapPickerModal';
import LocationAutocomplete from '../../components/LocationAutocomplete';
import { useRouter } from 'expo-router';

const PHONE_BRANDS  = ['iPhone','Samsung','OnePlus','Redmi','Vivo','Oppo','Realme','Nokia']
const LAPTOP_BRANDS = ['Dell','HP','Lenovo','MacBook','Asus','Acer','MSI','Sony']
const TV_BRANDS = ['Samsung','LG','Sony','Panasonic','Toshiba','MI','OnePlus','TCL']
const AC_BRANDS = ['Voltas','LG','Samsung','Blue Star','Daikin','Hitachi','Panasonic','Lloyd']
const FRIDGE_BRANDS = ['Samsung','LG','Whirlpool','Godrej','Haier','Panasonic','Bosch','Hitachi']
const WM_BRANDS = ['Samsung','LG','Whirlpool','Bosch','IFB','Godrej','Panasonic','Haier']

const SERVICE_CATEGORIES = [
  { key: 'mobile',       icon: '📱', label: 'Mobile Repair',             hasDeviceFlow: true },
  { key: 'laptop',       icon: '💻', label: 'Laptop & PC Repair',        hasDeviceFlow: true },
  { key: 'tv',           icon: '📺', label: 'TV Repair',                 hasDeviceFlow: true },
  { key: 'ac',           icon: '❄️', label: 'AC Service & Repair',       hasDeviceFlow: true },
  { key: 'refrigerator', icon: '🧊', label: 'Refrigerator Repair',       hasDeviceFlow: true },
  { key: 'washing',      icon: '🧺', label: 'Washing Machine Repair',     hasDeviceFlow: true },
  { key: 'electrician',  icon: '🔌', label: 'Electrician Services',      hasDeviceFlow: false },
  { key: 'plumbing',     icon: '🚰', label: 'Plumbing Services',          hasDeviceFlow: false },
  { key: 'cctv',         icon: '📡', label: 'CCTV Installation & Service', hasDeviceFlow: false },
  { key: 'wifi',         icon: '🌐', label: 'Wi-Fi Router Setup',        hasDeviceFlow: false },
  { key: 'ro',           icon: '💧', label: 'RO Water Purifier Service', hasDeviceFlow: false },
  { key: 'inverter',     icon: '🔋', label: 'Inverter & UPS Service',    hasDeviceFlow: false },
]

const SERVICE_BRANDS = {
  mobile: PHONE_BRANDS,
  laptop: LAPTOP_BRANDS,
  tv: TV_BRANDS,
  ac: AC_BRANDS,
  refrigerator: FRIDGE_BRANDS,
  washing: WM_BRANDS,
}

const STEPS = [
  { num: 1, label: 'Service',  icon: '🔧' },
  { num: 2, label: 'Brand',    icon: '🏷️' },
  { num: 3, label: 'Model',    icon: '✏️' },
  { num: 4, label: 'Issue',    icon: '🔧' },
  { num: 5, label: 'Photos',   icon: '📸' },
  { num: 6, label: 'Location', icon: '📍' },
  { num: 7, label: 'Pincode',  icon: '📮' },
  { num: 8, label: 'Confirm',  icon: '✅' },
]

export default function HomeScreen() {
  const router = useRouter();

  // ── User state ──
  const [custName, setCustName]           = useState('')
  const [custLocation, setCustLocation]   = useState('')
  const [custPhone, setCustPhone]         = useState('')
  const [myOrders, setMyOrders]           = useState([])

  // ── Booking wizard state ──
  const [bookingStep, setBookingStep]     = useState(0)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [selectedBrand, setSelectedBrand]   = useState(null)
  const [modelName, setModelName]           = useState('')
  const [issueDesc, setIssueDesc]           = useState('')
  const [deviceImages, setDeviceImages]     = useState([])
  const [deviceVideos, setDeviceVideos]     = useState([])
  const [locationInput, setLocationInput]   = useState('')
  const [pincodeInput, setPincodeInput]     = useState('')
  const [isSubmitting, setIsSubmitting]     = useState(false)
  const [activeTab, setActiveTab]           = useState('home')
  const [custLat, setCustLat]               = useState(null)
  const [custLng, setCustLng]               = useState(null)
  const [fsImages, setFsImages]             = useState([])
  const [fsIndex, setFsIndex]               = useState(0)
  const [fsVideos, setFsVideos]             = useState([])
  const [fsVideoIndex, setFsVideoIndex]     = useState(0)
  const [videoLoading, setVideoLoading]     = useState(true)
  const [orderFilter, setOrderFilter]       = useState('all') // 'all', 'today', 'week', 'month'
  const [showMapPicker, setShowMapPicker]   = useState(false)
  const [mapPickLat, setMapPickLat]         = useState(null)
  const [mapPickLng, setMapPickLng]         = useState(null)

  const ordersUnsubRef = useRef(null)

  // ── Load user data ─────────────────────────────────────────────────────
  useEffect(() => {
    loadUser()
    registerForNotifications().then(token => {
      if (token) AsyncStorage.setItem('pushToken', token)
    })
    return () => {
      if (ordersUnsubRef.current) { ordersUnsubRef.current(); ordersUnsubRef.current = null }
    }
  }, [])

  const loadUser = async () => {
    const n = await AsyncStorage.getItem('custName')
    const l = await AsyncStorage.getItem('custLocation')
    const p = await AsyncStorage.getItem('custPhone')
    setCustName(n || 'Customer')
    setCustLocation(l || 'Your Location')
    setCustPhone(p || '')
    setLocationInput(l || '')
    setPincodeInput(await AsyncStorage.getItem('custPincode') || '')
    listenOrders(p || '')
  }

  const listenOrders = (phone) => {
    if (ordersUnsubRef.current) { ordersUnsubRef.current() }
    ordersUnsubRef.current = onValue(ref(db, 'orders'), snap => {
      if (!snap.exists()) { setMyOrders([]); return }
      const orders = []
      snap.forEach(child => {
        const o = { id: child.key, ...child.val() }
        // Normalize images from Firebase (may be stored as object)
        if (o.images && !Array.isArray(o.images)) {
          o.images = typeof o.images === 'string' ? [o.images] : Object.values(o.images).filter(v => typeof v === 'string')
        }
        // Normalize videos from Firebase (may be stored as object)
        if (o.videos && !Array.isArray(o.videos)) {
          o.videos = typeof o.videos === 'string' ? [o.videos] : Object.values(o.videos).filter(v => typeof v === 'string')
        }
        if (!phone || o.customerPhone === phone) {
          orders.push(o)
        }
      })
      setMyOrders(orders.reverse())
    })
  }

  // ── Image picker ───────────────────────────────────────────────────────
  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access to photos to upload device images.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - deviceImages.length,
      quality: 0.8,
    })
    if (!result.canceled) {
      setDeviceImages(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 5))
    }
  }

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (!result.canceled) {
      setDeviceImages(prev => [...prev, result.assets[0].uri].slice(0, 5))
    }
  }

  const removeImage = (index) => {
    setDeviceImages(prev => prev.filter((_, i) => i !== index))
  }

  // ── Video picker ───────────────────────────────────────────────────────
  const pickVideos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access to gallery to upload videos.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: true,
      selectionLimit: 2 - deviceVideos.length,
    })
    if (!result.canceled) {
      setDeviceVideos(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 2))
    }
  }

  const recordVideo = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to record a video.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 60,
    })
    if (!result.canceled) {
      setDeviceVideos(prev => [...prev, result.assets[0].uri].slice(0, 2))
    }
  }

  const removeVideo = (index) => {
    setDeviceVideos(prev => prev.filter((_, i) => i !== index))
  }

  // ── Submit order ───────────────────────────────────────────────────────
  const submitOrder = async () => {
    const svc = SERVICE_CATEGORIES.find(s => s.key === selectedDevice)
    const deviceFlow = svc ? svc.hasDeviceFlow : false

    if (!selectedDevice || !issueDesc.trim()) {
      Alert.alert('Missing info', 'Please select a service and describe the issue.')
      return
    }
    if (deviceFlow && (!selectedBrand || !modelName.trim())) {
      Alert.alert('Missing info', 'Please fill in brand, model, and issue.')
      return
    }
    if (!locationInput.trim()) {
      Alert.alert('Missing location', 'Please enter your location.')
      return
    }
    setIsSubmitting(true)
    try {
      const name              = custName || 'Customer'
      const phone             = custPhone || ''
      const customerPushToken = await AsyncStorage.getItem('pushToken') || ''

      const tempOrderId = Date.now().toString()
      let imageUrls = null
      if (deviceImages.length > 0) {
        imageUrls = await uploadImages(deviceImages.map(uri => ({ uri })), tempOrderId)
      }
      let videoUrls = null
      if (deviceVideos.length > 0) {
        videoUrls = await uploadVideos(deviceVideos.map(uri => ({ uri })), tempOrderId)
      }

      // Only use GPS coords if the user explicitly used "My Location" or map picker
      // If user manually typed an address, don't override with current GPS position
      // (they might be at office but repair is at home)
      let orderLat = custLat, orderLng = custLng

      const svcCat = SERVICE_CATEGORIES.find(s => s.key === selectedDevice)
      const order = {
        customerName:       name,
        customerPhone:      phone,
        customerPushToken,
        custLat:            orderLat,
        custLng:            orderLng,
        location:           locationInput.trim(),
        pincode:            pincodeInput.trim(),
        serviceCategory:    selectedDevice,
        serviceLabel:       svcCat?.label || selectedDevice,
        device:             svcCat?.hasDeviceFlow ? selectedDevice : null,
        brand:              svcCat?.hasDeviceFlow ? selectedBrand : null,
        modelName:          svcCat?.hasDeviceFlow ? modelName.trim() : null,
        description:        issueDesc.trim(),
        images:             imageUrls || null,
        videos:             videoUrls || null,
        status:             'pending',
        time:               new Date().toLocaleTimeString(),
        createdAt:          Date.now(),
      }

      const newOrderRef = await push(ref(db, 'orders'), order)
      const orderId = newOrderRef.key

      await AsyncStorage.setItem('lastOrderId', orderId)
      await AsyncStorage.setItem('lastBrand', selectedBrand)
      await AsyncStorage.setItem('lastModelName', modelName.trim())
      await AsyncStorage.setItem('lastDescription', issueDesc.trim())
      await AsyncStorage.setItem('lastCustName', name)
      if (pincodeInput) await AsyncStorage.setItem('custPincode', pincodeInput.trim())
      if (locationInput) await AsyncStorage.setItem('custLocation', locationInput.trim())

      await notifyCustomerBookingConfirmed(svcCat?.label || selectedBrand, modelName.trim() || issueDesc.trim())
      await notifyTechsForNewOrder(order, orderId)
      resetWizard()

      Alert.alert(
        '✅ Booking Confirmed!',
        `${svcCat?.label || 'Service'}: ${selectedBrand ? selectedBrand + ' ' : ''}${modelName || issueDesc}\n\nTrack your technician?`,
        [
          { text: 'Track Now', onPress: () => router.push('/screens/TrackingScreen') },
          { text: '💬 Chat', onPress: () => router.push(`/screens/ChatScreen?orderId=${orderId}&role=cust&customerName=${encodeURIComponent(name)}&techName=`) },
          { text: 'Later' }
        ]
      )
    } catch (e) {
      console.error('Booking error:', e)
      Alert.alert('Error', 'Booking failed! Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetWizard = () => {
    setBookingStep(0)
    setActiveTab('home')
    setSelectedDevice(null)
    setSelectedBrand(null)
    setModelName('')
    setIssueDesc('')
    setDeviceImages([])
    setDeviceVideos([])
    setLocationInput(custLocation || '')
    setPincodeInput('')
  }

  const goNext = () => {
    const svc = SERVICE_CATEGORIES.find(s => s.key === selectedDevice)
    const deviceFlow = svc ? svc.hasDeviceFlow : true

    if (bookingStep === 1 && !selectedDevice) { Alert.alert('Select service', 'Please select a service category'); return }
    if (bookingStep === 2 && deviceFlow && !selectedBrand) { Alert.alert('Select brand', 'Please select a brand'); return }
    if (bookingStep === 3 && deviceFlow && !modelName.trim()) { Alert.alert('Enter model', 'Please enter your device model'); return }
    if (bookingStep === 4 && !issueDesc.trim()) { Alert.alert('Describe issue', 'Please describe the problem'); return }

    let next = bookingStep + 1
    // Non-device services: skip brand (step 2) and model (step 3)
    if (!deviceFlow && bookingStep === 1) next = 4
    setBookingStep(Math.min(next, 8))
  }

  const goBack = () => {
    if (bookingStep <= 1) { resetWizard(); return }
    const svc = SERVICE_CATEGORIES.find(s => s.key === selectedDevice)
    const deviceFlow = svc ? svc.hasDeviceFlow : true
    let prev = bookingStep - 1
    // Non-device services: skip back over model (step 3) and brand (step 2)
    if (!deviceFlow && bookingStep === 4) prev = 1
    setBookingStep(prev)
  }

  const renderProgressBar = () => {
    const selSvc = SERVICE_CATEGORIES.find(s => s.key === selectedDevice)
    const devFlow = selSvc ? selSvc.hasDeviceFlow : true
    const visSteps = STEPS.filter(s => devFlow || (s.num !== 2 && s.num !== 3))
    const total = visSteps.length || 8
    const curIdx = visSteps.findIndex(s => s.num === bookingStep) + 1
    return (
      <View style={s.progressContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.progressScroll}>
          {visSteps.map((step) => (
            <View key={step.num} style={s.progressStepWrap}>
              <View style={[s.progressDot, bookingStep >= step.num && s.progressDotActive, bookingStep === step.num && s.progressDotCurrent]}>
                <Text style={s.progressDotTxt}>{step.icon}</Text>
              </View>
              <Text style={[s.progressLabel, bookingStep >= step.num && s.progressLabelActive]} numberOfLines={1}>{step.label}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${(curIdx / total) * 100}%` }]} />
        </View>
      </View>
    )
  }

  const renderStep1 = () => (
    <View style={s.stepBody}>
      <Text style={s.stepTitle}>🔧 Select Service</Text>
      <Text style={s.stepSubtitle}>What do you need help with?</Text>
      <View style={s.serviceGrid}>
        {SERVICE_CATEGORIES.map(svc => (
          <TouchableOpacity key={svc.key} style={[s.serviceCard, selectedDevice === svc.key && s.serviceCardActive]} onPress={() => { setSelectedDevice(svc.key); if (svc.key !== selectedDevice) setSelectedBrand(null) }}>
            <Text style={s.serviceIcon}>{svc.icon}</Text>
            <Text style={s.serviceLabel}>{svc.label}</Text>
            {svc.hasDeviceFlow && <Text style={s.serviceBadge}>Brand/Model</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )

  const renderStep2 = () => {
    const brands = SERVICE_BRANDS[selectedDevice] || PHONE_BRANDS
    const svc = SERVICE_CATEGORIES.find(s => s.key === selectedDevice)
    return (
      <View style={s.stepBody}>
        <Text style={s.stepTitle}>🏷️ Select Brand</Text>
        <Text style={s.stepSubtitle}>Choose the brand for {svc?.label || 'your device'}</Text>
        <View style={s.brandGrid}>
          {brands.map(brand => (
            <TouchableOpacity key={brand} style={[s.brandCard, selectedBrand === brand && s.brandCardActive]} onPress={() => setSelectedBrand(brand)}>
              <Text style={s.brandIcon}>{svc?.icon || '📱'}</Text>
              <Text style={s.brandLabel}>{brand}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    )
  }

  const renderStep3 = () => {
    const svc = SERVICE_CATEGORIES.find(s => s.key === selectedDevice)
    return (
      <View style={s.stepBody}>
        <Text style={s.stepTitle}>✏️ Model / Details</Text>
        <Text style={s.stepSubtitle}>e.g. iPhone 14 Pro Max, Samsung Galaxy S24 — or describe your model</Text>
        <View style={s.inputCard}>
          <Text style={s.inputLabel}>{svc?.label || 'Device'} Model</Text>
          <TextInput style={s.textInput} placeholder={`e.g. ${selectedBrand || svc?.label} model...`} placeholderTextColor="#bbb" value={modelName} onChangeText={setModelName} maxLength={100} />
        </View>
      </View>
    )
  }

  const renderStep4 = () => (
    <View style={s.stepBody}>
      <Text style={s.stepTitle}>🔧 Describe the Issue</Text>
      <Text style={s.stepSubtitle}>What's wrong with your device? Be specific.</Text>
      <View style={s.inputCard}>
        <Text style={s.inputLabel}>Problem Description</Text>
        <TextInput style={[s.textInput, s.textArea]} placeholder="e.g. Screen is cracked, touch not responding..." placeholderTextColor="#bbb" value={issueDesc} onChangeText={setIssueDesc} multiline numberOfLines={5} maxLength={2000} textAlignVertical="top" />
        <Text style={s.charCount}>{issueDesc.length}/2000</Text>
      </View>
    </View>
  )

  const renderStep5 = () => (
    <View style={s.stepBody}>
      <Text style={s.stepTitle}>📸 Add Photos & Videos</Text>
      <Text style={s.stepSubtitle}>Upload photos (up to 5) or videos (up to 2) of the issue</Text>
      {/* ── Photos ── */}
      <View style={s.mediaSection}>
        <Text style={s.mediaSectionTitle}>📷 Photos</Text>
        {deviceImages.length > 0 && (
          <FlatList horizontal data={deviceImages} keyExtractor={(_, i) => String(i)} showsHorizontalScrollIndicator={false} contentContainerStyle={s.imageList} renderItem={({ item, index }) => (
            <View style={s.imageThumbWrap}>
              <Image source={{ uri: item }} style={s.imageThumb} />
              <TouchableOpacity style={s.imageRemove} onPress={() => removeImage(index)}><Text style={s.imageRemoveTxt}>✕</Text></TouchableOpacity>
            </View>
          )} />
        )}
        {deviceImages.length < 5 && (
          <View style={s.imageActions}>
            <TouchableOpacity style={s.imageBtn} onPress={pickImages}><Text style={s.imageBtnIcon}>🖼️</Text><Text style={s.imageBtnLabel}>Gallery</Text></TouchableOpacity>
            <TouchableOpacity style={s.imageBtn} onPress={takePhoto}><Text style={s.imageBtnIcon}>📷</Text><Text style={s.imageBtnLabel}>Camera</Text></TouchableOpacity>
          </View>
        )}
        <Text style={s.mediaHint}>{deviceImages.length}/5 photos added</Text>
      </View>
      {/* ── Videos ── */}
      <View style={s.mediaSection}>
        <Text style={s.mediaSectionTitle}>🎥 Videos</Text>
        {deviceVideos.length > 0 && (
          <FlatList horizontal data={deviceVideos} keyExtractor={(_, i) => String(i)} showsHorizontalScrollIndicator={false} contentContainerStyle={s.imageList} renderItem={({ item, index }) => (
            <View style={s.videoThumbWrap}>
              <View style={s.videoThumb}>
                <Text style={s.videoPlayIcon}>▶️</Text>
              </View>
              <TouchableOpacity style={s.imageRemove} onPress={() => removeVideo(index)}><Text style={s.imageRemoveTxt}>✕</Text></TouchableOpacity>
            </View>
          )} />
        )}
        {deviceVideos.length < 2 && (
          <View style={s.imageActions}>
            <TouchableOpacity style={s.imageBtn} onPress={pickVideos}><Text style={s.imageBtnIcon}>🎬</Text><Text style={s.imageBtnLabel}>Gallery</Text></TouchableOpacity>
            <TouchableOpacity style={s.imageBtn} onPress={recordVideo}><Text style={s.imageBtnIcon}>📹</Text><Text style={s.imageBtnLabel}>Record</Text></TouchableOpacity>
          </View>
        )}
        <Text style={s.mediaHint}>{deviceVideos.length}/2 videos added {deviceVideos.length === 0 && deviceImages.length === 0 ? '(optional — skip if not needed)' : ''}</Text>
      </View>
    </View>
  )

  // ── Map picker callback (defined at component level so the modal can access it) ──
  const handleMapPick = (lat, lng) => {
    setMapPickLat(lat)
    setMapPickLng(lng)
    setCustLat(lat)
    setCustLng(lng)
    // Reverse geocode to fill address
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`)
      .then(r => r.json())
      .then(data => {
        if (data.display_name) {
          const parts = data.display_name.split(',')
          const shortAddr = parts.slice(0, 4).join(',')
          setLocationInput(shortAddr)
        } else {
          setLocationInput(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        }
      })
      .catch(() => {
        setLocationInput(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      })
  }

  const renderStep6 = () => {
    const useCurrentLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') { Alert.alert('Permission denied', 'Allow location access to auto-fill.'); return }
      const pos = await Location.getCurrentPositionAsync({})
      const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      if (place) {
        setLocationInput([place.name, place.district, place.city, place.region].filter(Boolean).join(', '))
        setCustLat(pos.coords.latitude)
        setCustLng(pos.coords.longitude)
      }
    }

    return (
      <View style={s.stepBody}>
        <Text style={s.stepTitle}>📍 Repair Location</Text>
        <Text style={s.stepSubtitle}>Where should the technician come? (e.g. your home, a relative's place, etc.)</Text>
        <LocationAutocomplete
          value={locationInput}
          onChangeText={(t) => {
            setLocationInput(t)
            // User is typing manually, so clear map/GPS coords to avoid mismatch
            if (!t) { setCustLat(null); setCustLng(null) }
          }}
          placeholder="Search your repair address..."
          icon="📍"
        />
        <TouchableOpacity style={s.gpsBtn} onPress={useCurrentLocation}>
          <Text style={s.gpsBtnTxt}>📍 Use Current Location</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.gpsBtn, { backgroundColor: '#1A3A6B', marginTop: 10, borderWidth: 2, borderColor: '#FF6B00' }]}
          onPress={async () => {
            // Pre-fetch user's current GPS so the map opens at their real location
            try {
              const { status } = await Location.requestForegroundPermissionsAsync()
              if (status === 'granted') {
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 8000 })
                if (pos && pos.coords) {
                  setCustLat(pos.coords.latitude)
                  setCustLng(pos.coords.longitude)
                }
              }
            } catch (_) { /* fallback to default coordinates */ }
            setShowMapPicker(true)
          }}
        >
          <Text style={s.gpsBtnTxt}>🗺️ Select on Map (Search / Satellite / Pin)</Text>
        </TouchableOpacity>
        {mapPickLat && mapPickLng && (
          <View style={s.mapCoordsBadge}>
            <Text style={s.mapCoordsTxt}>📍 Pinned: {mapPickLat.toFixed(5)}, {mapPickLng.toFixed(5)}</Text>
          </View>
        )}
      </View>
    )
  }

  const renderStep7 = () => (
    <View style={s.stepBody}>
      <Text style={s.stepTitle}>📮 Pincode</Text>
      <Text style={s.stepSubtitle}>Enter your area pincode</Text>
      <View style={s.inputCard}>
        <Text style={s.inputLabel}>Pincode</Text>
        <TextInput style={s.textInput} placeholder="e.g. 500081" placeholderTextColor="#bbb" value={pincodeInput} onChangeText={t => setPincodeInput(t.replace(/[^0-9]/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} />
      </View>
    </View>
  )

  const renderStep8 = () => {
    const svc = SERVICE_CATEGORIES.find(s => s.key === selectedDevice)
    const deviceFlow = svc ? svc.hasDeviceFlow : false
    const reviewRows = [
      ['🔧','Service', svc?.label || selectedDevice],
      ...(deviceFlow ? [['🏷️','Brand', selectedBrand || '—'], ['✏️','Model', modelName || '—']] : []),
      ['🔧','Issue', issueDesc || '—'],
      ['📸','Photos', deviceImages.length > 0 ? `${deviceImages.length} photo(s)` : 'None'],
      ['🎥','Videos', deviceVideos.length > 0 ? `${deviceVideos.length} video(s)` : 'None'],
      ['📍','Location', locationInput || '—'],
      ['📮','Pincode', pincodeInput || '—'],
    ]
    return (
      <View style={s.stepBody}>
        <Text style={s.stepTitle}>✅ Review & Confirm</Text>
        <Text style={s.stepSubtitle}>Check your booking details</Text>
        <View style={s.reviewCard}>
          {reviewRows.map(([icon, label, value], i) => (
            <View key={i} style={s.reviewRow}>
              <Text style={s.reviewIcon}>{icon}</Text>
              <View style={{ flex: 1 }}><Text style={s.reviewLabel}>{label}</Text><Text style={s.reviewValue} numberOfLines={label === 'Issue' ? 3 : 1}>{value}</Text></View>
            </View>
          ))}
        </View>
        {isSubmitting && <View style={s.submittingOverlay}><ActivityIndicator size="large" color="#FF6B00" /><Text style={s.submittingTxt}>Uploading & Booking...</Text></View>}
      </View>
    )
  }

  const renderWizardStep = () => {
    const svc = SERVICE_CATEGORIES.find(s => s.key === selectedDevice)
    const deviceFlow = svc ? svc.hasDeviceFlow : true
    switch (bookingStep) {
      case 1: return renderStep1()
      case 2: return deviceFlow ? renderStep2() : renderStep4()
      case 3: return deviceFlow ? renderStep3() : renderStep5()
      case 4: return renderStep4()
      case 5: return renderStep5()
      case 6: return renderStep6()
      case 7: return renderStep7()
      case 8: return renderStep8()
      default: return null
    }
  }

  // ── HOME TAB ──
  const renderHome = () => (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <View><Text style={s.greeting}>Good Morning! 👋</Text><Text style={s.userName}>{custName}</Text><Text style={s.userLoc}>📍 {custLocation}</Text></View>
        <TouchableOpacity style={s.avatar} onPress={() => router.push('/screens/CustomerProfileScreen')}><Text style={{ fontSize: 24 }}>👤</Text></TouchableOpacity>
      </View>
      <View style={s.searchBar}><Text style={{ fontSize: 16 }}>🔍</Text><TextInput style={s.searchInput} placeholder="Search repair service..." placeholderTextColor="#aaa" /></View>
      <TouchableOpacity style={s.banner} onPress={() => setBookingStep(1)}>
        <View><Text style={s.bannerText}>🔧 Expert Repair at Your Doorstep!</Text><Text style={s.bannerSub}>Book in 30 seconds!</Text></View>
        <View style={s.bannerCta}><Text style={s.bannerCtaTxt}>🔧 Book Now</Text></View>
      </TouchableOpacity>
      {/* Quick Service Strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.quickServiceStrip} contentContainerStyle={{ paddingHorizontal: 15, gap: 10 }}>
        {SERVICE_CATEGORIES.slice(0, 6).map(svc => (
          <TouchableOpacity key={svc.key} style={s.quickServiceItem} onPress={() => { setSelectedDevice(svc.key); setBookingStep(1) }}>
            <Text style={s.quickServiceIcon}>{svc.icon}</Text>
            <Text style={s.quickServiceLabel} numberOfLines={1}>{svc.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={s.sectionTitle}>⭐ Why DoToR?</Text>
      {[{ icon:'🏠', title:'Doorstep Service', desc:'Technician comes to your home!' },{ icon:'👀', title:'Repair in Front of You', desc:'100% transparent process!' },{ icon:'⚡', title:'Fast Service', desc:'Arrives within 60 mins!' },{ icon:'💰', title:'Best Price', desc:'No hidden charges ever!' }].map((item, i) => (
        <View key={i} style={s.whyItem}><Text style={s.whyIcon}>{item.icon}</Text><View><Text style={s.whyTitle}>{item.title}</Text><Text style={s.whyDesc}>{item.desc}</Text></View></View>
      ))}
      <View style={{ height: 90 }} />
    </ScrollView>
  )

  const renderWizard = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.wizardHeader}>
        <TouchableOpacity onPress={goBack} style={s.wizardBackBtn}><Text style={s.wizardBackTxt}>← Back</Text></TouchableOpacity>
        <Text style={s.wizardTitle}>Book Repair</Text>
        <TouchableOpacity onPress={resetWizard} style={s.wizardCancelBtn}><Text style={s.wizardCancelTxt}>✕</Text></TouchableOpacity>
      </View>
      {renderProgressBar()}
      <ScrollView style={s.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {renderWizardStep()}
      </ScrollView>
      <View style={s.wizardBottom}>
        {bookingStep < 8 ? (
          <TouchableOpacity style={s.nextBtn} onPress={goNext}><Text style={s.nextBtnTxt}>Continue →</Text></TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.nextBtn, isSubmitting && s.nextBtnDisabled]} onPress={submitOrder} disabled={isSubmitting}><Text style={s.nextBtnTxt}>{isSubmitting ? 'Booking...' : '✅ Submit Booking'}</Text></TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  )

  // ── Orders tab (inline for customers) ──
  const renderOrdersTab = () => {
    // Compute date boundaries for filter
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    // Apply date filter to myOrders
    let filteredOrders = myOrders
    if (orderFilter === 'today') {
      filteredOrders = myOrders.filter(o => {
        const t = o.createdAt || 0
        return t >= todayStart && t < todayStart + 86400000
      })
    } else if (orderFilter === 'week') {
      filteredOrders = myOrders.filter(o => {
        const t = o.createdAt || 0
        return t >= weekStart
      })
    } else if (orderFilter === 'month') {
      filteredOrders = myOrders.filter(o => {
        const t = o.createdAt || 0
        return t >= monthStart
      })
    }

    // Compute counts for filter tabs
    const todayCount = myOrders.filter(o => {
      const t = o.createdAt || 0; return t >= todayStart && t < todayStart + 86400000
    }).length
    const weekCount = myOrders.filter(o => {
      const t = o.createdAt || 0; return t >= weekStart
    }).length
    const monthCount = myOrders.filter(o => {
      const t = o.createdAt || 0; return t >= monthStart
    }).length

    const FILTER_TABS = [
      { key: 'all', label: `All (${myOrders.length})` },
      { key: 'today', label: `Today (${todayCount})` },
      { key: 'week', label: `Week (${weekCount})` },
      { key: 'month', label: `Month (${monthCount})` },
    ]

    return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>📋</Text>
          <Text style={s.userName}>My Orders</Text>
          <Text style={s.userLoc}>{myOrders.length} orders total</Text>
        </View>
      </View>

      {/* FILTER TABS */}
      <View style={s.filterRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.filterTab, orderFilter === tab.key && s.filterTabActive]}
            onPress={() => setOrderFilter(tab.key)}
          >
            <Text style={[s.filterText, orderFilter === tab.key && s.filterTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredOrders.length === 0 ? (
        <View style={{ padding: 50, alignItems: 'center' }}>
          <Text style={{ fontSize: 50, marginBottom: 15 }}>📦</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A3A6B' }}>No orders found</Text>
          <Text style={{ fontSize: 13, color: '#888', marginTop: 5 }}>
            {orderFilter !== 'all' ? 'No orders in this time period' : 'Book your first repair and it will appear here!'}
          </Text>
        </View>
      ) : (() => {
        const ongoingOrders = filteredOrders.filter(o => o.status !== 'completed')
        const completedOrders = filteredOrders.filter(o => o.status === 'completed')
        return (
          <>
            {/* Ongoing orders section */}
            {ongoingOrders.length > 0 && (
              <>
                <Text style={s.sectionTitle}>🟢 Ongoing Orders</Text>
                {ongoingOrders.map((order, i) => {
                  const statusColor = order.status === 'accepted' ? '#FF6B00' : '#888'
                  const statusIcon = order.status === 'accepted' ? '🔧' : '⏳'
                  return (
                    <TouchableOpacity key={order.id || i} style={[s.orderCard, { borderLeftColor: '#FF6B00' }]} onPress={async () => {
                      try {
                        if (order.status !== 'completed' && order.status !== 'cancelled') {
                          if (order.id) {
                            await AsyncStorage.setItem('lastOrderId', order.id)
                            router.push('/screens/TrackingScreen')
                          }
                        }
                      } catch (e) {
                        console.log('Order card navigation error:', e)
                      }
                    }}>
                      <View style={s.orderLeft}>
                        <Text style={s.orderDevice}>{order.serviceLabel ? `🔧 ${order.serviceLabel}` : `📱 ${order.brand || ''}`}{order.brand && order.modelName ? ` — ${order.modelName}` : ''}</Text>
                        {order.description ? <Text style={s.orderRepair}>🔧 {order.description}</Text> : null}
                        {order.images && order.images.length > 0 && (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                            {order.images.map((url, j) => (
                              <TouchableOpacity key={j} onPress={() => { setFsImages(order.images); setFsIndex(j) }}>
                                <Image source={{ uri: url }} style={s.orderImage} />
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}
                        {order.videos && order.videos.length > 0 && (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                            {order.videos.map((url, j) => (
                              <TouchableOpacity key={j} onPress={() => { setFsVideos(order.videos); setFsVideoIndex(j) }}>
                                <View style={s.videoThumbSm}>
                                  <Text style={s.videoPlayIconSm}>▶️</Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}
                        <Text style={s.orderLoc}>📍 {order.location}</Text>
                        {order.pincode ? <Text style={s.orderLoc}>📮 {order.pincode}</Text> : null}
                        <Text style={s.orderTime}>🕐 {order.time}</Text>
                      </View>
                      <View style={s.orderRight}>
                        <Text style={[s.orderStatus, { color: statusColor }]}>{statusIcon}</Text>
                        <Text style={[s.orderStatusLabel, { color: statusColor }]}>{order.status}</Text>
                        {order.id && (
                          <TouchableOpacity style={s.orderChatBtn} onPress={() => {
                            try {
                              router.push(`/screens/ChatScreen?orderId=${order.id}&role=cust&customerName=${encodeURIComponent(custName)}&techName=${encodeURIComponent(order.techName || '')}`)
                            } catch (e) {
                              console.log('Chat navigation error:', e)
                            }
                          }}>
                            <Text style={s.orderChatTxt}>💬 Chat</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </>
            )}

            {/* Completed orders section */}
            {completedOrders.length > 0 && (
              <>
                <Text style={s.sectionTitle}>✅ Completed Orders</Text>
                {completedOrders.map((order, i) => (
                  <View key={order.id || i} style={[s.orderCard, { borderLeftColor: '#2e7d32', opacity: 0.8 }]}>
                    <View style={s.orderLeft}>
                      <Text style={s.orderDevice}>{order.serviceLabel ? `✅ ${order.serviceLabel}` : `📱 ${order.brand || ''}`}{order.brand && order.modelName ? ` — ${order.modelName}` : ''}</Text>
                      {order.description ? <Text style={[s.orderRepair, { color: '#2e7d32' }]}>✅ {order.description}</Text> : null}
                      {order.images && order.images.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                          {order.images.map((url, j) => (
                            <TouchableOpacity key={j} onPress={() => { setFsImages(order.images); setFsIndex(j) }}>
                              <Image source={{ uri: url }} style={s.orderImage} />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                      {order.videos && order.videos.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                          {order.videos.map((url, j) => (
                            <TouchableOpacity key={j} onPress={() => { setFsVideos(order.videos); setFsVideoIndex(j) }}>
                              <View style={s.videoThumbSm}>
                                <Text style={s.videoPlayIconSm}>▶️</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                      <Text style={s.orderLoc}>📍 {order.location}</Text>
                      {order.pincode ? <Text style={s.orderLoc}>📮 {order.pincode}</Text> : null}
                      <Text style={s.orderTime}>🕐 {order.time}</Text>
                    </View>
                    <View style={s.orderRight}>
                      <Text style={[s.orderStatus, { color: '#2e7d32' }]}>✅</Text>
                      <Text style={[s.orderStatusLabel, { color: '#2e7d32' }]}>Completed</Text>
                      {order.id && (
                        <TouchableOpacity style={[s.orderChatBtn, { backgroundColor: '#2e7d32' }]} onPress={() => {
                          try {
                            router.push(`/screens/ChatScreen?orderId=${order.id}&role=cust&customerName=${encodeURIComponent(custName)}&techName=${encodeURIComponent(order.techName || '')}`)
                          } catch (e) {
                            console.log('Chat navigation error:', e)
                          }
                        }}>
                          <Text style={s.orderChatTxt}>💬 Chat</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )
      })()}
      <View style={{ height: 90 }} />
    </ScrollView>
  )
  }

  /* ── Full-Screen Image Viewer Modal (with forward/backward nav) ── */
  const renderImageModal = () => (
    <Modal visible={fsImages.length > 0} transparent onRequestClose={() => setFsImages([])}>
      <View style={s.fsOverlay}>
        <TouchableOpacity style={s.fsClose} onPress={() => setFsImages([])}>
          <Text style={s.fsCloseTxt}>✕</Text>
        </TouchableOpacity>

        <Text style={s.fsCounter}>{fsIndex + 1} / {fsImages.length}</Text>

        <View style={s.fsContent}>
          {fsIndex > 0 && (
            <TouchableOpacity style={s.fsArrow} onPress={() => setFsIndex(i => i - 1)}>
              <Text style={s.fsArrowTxt}>‹</Text>
            </TouchableOpacity>
          )}

          {fsImages.length > 0 && (
            <Image source={{ uri: fsImages[fsIndex] }} style={s.fsImage} resizeMode="contain" />
          )}

          {fsIndex < fsImages.length - 1 && (
            <TouchableOpacity style={s.fsArrow} onPress={() => setFsIndex(i => i + 1)}>
              <Text style={s.fsArrowTxt}>›</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  )

  /* ── Full-Screen Video Player Modal ── */
  const renderVideoModal = () => (
    <Modal visible={fsVideos.length > 0} transparent onRequestClose={() => { setFsVideos([]); setFsVideoIndex(0) }}>
      <View style={s.fsOverlay}>
        <TouchableOpacity style={s.fsClose} onPress={() => { setFsVideos([]); setFsVideoIndex(0) }}>
          <Text style={s.fsCloseTxt}>✕</Text>
        </TouchableOpacity>

        <Text style={s.fsCounter}>{fsVideoIndex + 1} / {fsVideos.length}</Text>

        <View style={s.fsContent}>
          {fsVideoIndex > 0 && (
            <TouchableOpacity style={s.fsArrow} onPress={() => setFsVideoIndex(i => i - 1)}>
              <Text style={s.fsArrowTxt}>‹</Text>
            </TouchableOpacity>
          )}

          {fsVideos.length > 0 && (
            <View style={{ flex: 1, height: '70%', justifyContent: 'center', alignItems: 'center' }}>
              <Video
                source={{ uri: fsVideos[fsVideoIndex] }}
                style={{ width: '100%', height: '100%' }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                onLoadStart={() => setVideoLoading(true)}
                onLoad={() => setVideoLoading(false)}
                onError={() => setVideoLoading(false)}
              />
              {videoLoading ? (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#FF6B00" />
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginTop: 10 }}>Loading video...</Text>
                </View>
              ) : null}
            </View>
          )}

          {fsVideoIndex < fsVideos.length - 1 && (
            <TouchableOpacity style={s.fsArrow} onPress={() => setFsVideoIndex(i => i + 1)}>
              <Text style={s.fsArrowTxt}>›</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  )

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {bookingStep > 0 ? renderWizard() : (
        <>
          {activeTab === 'home' && renderHome()}
          {activeTab === 'orders' && renderOrdersTab()}
          {renderImageModal()}
          {renderVideoModal()}
          <View style={s.tabBar}>
            <TouchableOpacity style={[s.tabItem, activeTab === 'home' && s.tabItemActive]} onPress={() => setActiveTab('home')}><Text style={[s.tabIcon, activeTab === 'home' && s.tabIconActive]}>🏠</Text><Text style={[s.tabLabel, activeTab === 'home' && s.tabLabelActive]}>Home</Text></TouchableOpacity>
            <TouchableOpacity style={s.tabItem} onPress={() => setBookingStep(1)}><Text style={s.tabIcon}>🔧</Text><Text style={s.tabLabel}>Book</Text></TouchableOpacity>
            <TouchableOpacity style={[s.tabItem, activeTab === 'orders' && s.tabItemActive]} onPress={() => setActiveTab('orders')}><Text style={[s.tabIcon, activeTab === 'orders' && s.tabIconActive]}>📋</Text><Text style={[s.tabLabel, activeTab === 'orders' && s.tabLabelActive]}>Orders</Text></TouchableOpacity>
            <TouchableOpacity style={s.tabItem} onPress={() => router.push('/screens/CustomerProfileScreen')}><Text style={s.tabIcon}>👤</Text><Text style={s.tabLabel}>Profile</Text></TouchableOpacity>
          </View>
        </>
      )}

      {/* Map Picker Modal */}
      <MapPickerModal
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onLocationSelected={handleMapPick}
        initialLat={custLat || mapPickLat || 17.3850}
        initialLng={custLng || mapPickLng || 78.4867}
      />

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
  whyItem:          { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', padding: 14, marginHorizontal: 15, marginBottom: 10, borderRadius: 14, elevation: 2 },
  whyIcon:          { fontSize: 28 },
  whyTitle:         { fontSize: 13, fontWeight: '800', color: '#1A3A6B' },
  whyDesc:          { fontSize: 11, color: '#888', marginTop: 2 },
  // Wizard header
  wizardHeader:     { backgroundColor: '#FF6B00', padding: 16, paddingTop: 55, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wizardBackBtn:    { padding: 6 },
  wizardBackTxt:    { color: '#fff', fontSize: 15, fontWeight: '700' },
  wizardTitle:      { color: '#fff', fontSize: 17, fontWeight: '800' },
  wizardCancelBtn:  { padding: 6 },
  wizardCancelTxt:  { color: '#fff', fontSize: 18, fontWeight: '800' },
  // Progress bar
  progressContainer: { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  progressScroll:   { paddingHorizontal: 12 },
  progressStepWrap: { alignItems: 'center', width: 52, marginHorizontal: 4 },
  progressDot:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  progressDotActive: { backgroundColor: '#FFE0CC' },
  progressDotCurrent:{ backgroundColor: '#FF6B00', elevation: 3 },
  progressDotTxt:   { fontSize: 14 },
  progressLabel:    { fontSize: 9, color: '#bbb', fontWeight: '600', marginTop: 4, textAlign: 'center' },
  progressLabelActive: { color: '#FF6B00', fontWeight: '800' },
  progressTrack:    { height: 3, backgroundColor: '#eee', marginHorizontal: 15, marginTop: 8, borderRadius: 2 },
  progressFill:     { height: 3, backgroundColor: '#FF6B00', borderRadius: 2 },
  // Step body
  stepBody:         { padding: 15 },
  stepTitle:        { fontSize: 20, fontWeight: '800', color: '#1A3A6B', marginBottom: 4 },
  stepSubtitle:     { fontSize: 13, color: '#888', marginBottom: 18 },
  // Service categories grid
  serviceGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  serviceCard:      { width: '30%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 3, borderWidth: 2, borderColor: 'transparent', justifyContent: 'center', minHeight: 100 },
  serviceCardActive:{ borderColor: '#FF6B00', backgroundColor: '#FFF5EE' },
  serviceIcon:      { fontSize: 28 },
  serviceLabel:     { fontSize: 11, fontWeight: '800', color: '#1A3A6B', marginTop: 6, textAlign: 'center' },
  serviceBadge:     { fontSize: 8, color: '#FF6B00', fontWeight: '700', marginTop: 4, backgroundColor: '#FFF0E6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  // Quick service strip
  quickServiceStrip:{ marginTop: 10, marginBottom: 5 },
  quickServiceItem: { backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', elevation: 2, borderWidth: 1, borderColor: '#f0f0f0', minWidth: 80 },
  quickServiceIcon: { fontSize: 24 },
  quickServiceLabel:{ fontSize: 10, fontWeight: '700', color: '#1A3A6B', marginTop: 4, textAlign: 'center' },
  // Brand cards
  brandGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  brandCard:        { width: '30%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 2, borderWidth: 2, borderColor: 'transparent' },
  brandCardActive:  { borderColor: '#FF6B00', backgroundColor: '#FFF5EE' },
  brandIcon:        { fontSize: 28 },
  brandLabel:       { fontSize: 12, fontWeight: '800', color: '#1A3A6B', marginTop: 6, textAlign: 'center' },
  // Inputs
  inputCard:        { backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 2, marginBottom: 12 },
  inputLabel:       { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 8 },
  textInput:        { fontSize: 15, color: '#333', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8 },
  textArea:         { height: 120, borderBottomWidth: 0 },
  charCount:        { fontSize: 11, color: '#bbb', textAlign: 'right', marginTop: 6 },
  gpsBtn:           { backgroundColor: '#1A3A6B', padding: 14, borderRadius: 14, alignItems: 'center', elevation: 2 },
  gpsBtnTxt:        { color: '#fff', fontSize: 14, fontWeight: '800' },
  mapCoordsBadge:   { backgroundColor: '#e8f5e9', padding: 10, borderRadius: 10, marginTop: 10, alignItems: 'center', borderWidth: 1, borderColor: '#c8e6c9' },
  mapCoordsTxt:     { fontSize: 12, fontWeight: '700', color: '#2e7d32' },
  // Images
  imageList:        { paddingVertical: 8, gap: 10 },
  imageThumbWrap:   { position: 'relative' },
  imageThumb:       { width: 100, height: 100, borderRadius: 12 },
  imageRemove:      { position: 'absolute', top: -6, right: -6, backgroundColor: '#c62828', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  imageRemoveTxt:   { color: '#fff', fontSize: 12, fontWeight: '800' },
  imageActions:     { flexDirection: 'row', gap: 12, marginTop: 10 },
  imageBtn:         { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 18, alignItems: 'center', elevation: 2, borderWidth: 1, borderColor: '#eee' },
  imageBtnIcon:     { fontSize: 28 },
  imageBtnLabel:    { fontSize: 12, fontWeight: '700', color: '#1A3A6B', marginTop: 6 },
  imageHint:        { fontSize: 11, color: '#bbb', marginTop: 10, textAlign: 'center' },
  // Media sections (photos & videos)
  mediaSection:     { backgroundColor: '#fff', borderRadius: 14, padding: 14, elevation: 2, marginBottom: 14 },
  mediaSectionTitle:{ fontSize: 13, fontWeight: '800', color: '#1A3A6B', marginBottom: 8 },
  mediaHint:        { fontSize: 11, color: '#bbb', marginTop: 8, textAlign: 'center' },
  videoThumbWrap:   { position: 'relative', marginRight: 10 },
  videoThumb:       { width: 100, height: 100, borderRadius: 12, backgroundColor: '#1A3A6B', alignItems: 'center', justifyContent: 'center' },
  videoPlayIcon:    { fontSize: 32 },
  // Review
  reviewCard:       { backgroundColor: '#fff', borderRadius: 14, padding: 16, elevation: 2 },
  reviewRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  reviewIcon:       { fontSize: 20, marginTop: 2 },
  reviewLabel:      { fontSize: 11, fontWeight: '700', color: '#888' },
  reviewValue:      { fontSize: 14, fontWeight: '700', color: '#1A3A6B', marginTop: 2 },
  submittingOverlay:{ alignItems: 'center', padding: 30 },
  submittingTxt:    { fontSize: 14, fontWeight: '700', color: '#FF6B00', marginTop: 10 },
  wizardBottom:     { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 15, paddingBottom: 30, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  nextBtn:          { backgroundColor: '#FF6B00', padding: 16, borderRadius: 14, alignItems: 'center', elevation: 3 },
  nextBtnDisabled:  { opacity: 0.6 },
  nextBtnTxt:       { color: '#fff', fontSize: 16, fontWeight: '800' },
  // ── Filter Tabs ──
  filterRow:      { flexDirection: 'row', marginHorizontal: 15, marginTop: 12, marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 2 },
  filterTab:      { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  filterTabActive:{ borderBottomColor: '#FF6B00' },
  filterText:     { fontSize: 11, fontWeight: '700', color: '#888' },
  filterTextActive:{ color: '#FF6B00', fontWeight: '800' },

  // Tab bar
  // Order cards
  orderCard:        { backgroundColor: '#fff', borderRadius: 14, padding: 15, marginHorizontal: 15, marginBottom: 10, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#FF6B00', flexDirection: 'row', justifyContent: 'space-between' },
  orderLeft:        { flex: 1 },
  orderDevice:      { fontSize: 14, fontWeight: '800', color: '#1A3A6B' },
  orderRepair:      { fontSize: 12, color: '#FF6B00', fontWeight: '600', marginTop: 3 },
  orderLoc:         { fontSize: 11, color: '#888', marginTop: 3 },
  orderTime:        { fontSize: 11, color: '#888', marginTop: 3 },
  orderRight:       { alignItems: 'flex-end', gap: 4, justifyContent: 'center' },
  orderStatus:      { fontSize: 18 },
  orderStatusLabel: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  orderChatBtn:     { backgroundColor: '#FF6B00', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginTop: 4 },
  orderChatTxt:     { color: '#fff', fontSize: 10, fontWeight: '800' },
  orderImage:       { width: 70, height: 70, borderRadius: 10, marginRight: 8 },
  videoThumbSm:     { width: 70, height: 70, borderRadius: 10, marginRight: 8, backgroundColor: '#1A3A6B', alignItems: 'center', justifyContent: 'center' },
  videoPlayIconSm:  { fontSize: 28 },
  // Tab bar
  tabBar:           { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#fff', paddingBottom: 25, paddingTop: 8, elevation: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  tabItem:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, position: 'relative' },
  tabItemActive:    {},
  tabIcon:          { fontSize: 22, opacity: 0.5 },
  tabIconActive:    { opacity: 1 },
  tabLabel:         { fontSize: 10, fontWeight: '600', color: '#888', marginTop: 2 },
  tabLabelActive:   { color: '#FF6B00', fontWeight: '800' },

  // ── Full-screen Image Modal ──
  fsOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  fsClose:        { position: 'absolute', top: 55, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  fsCloseTxt:     { color: '#fff', fontSize: 18, fontWeight: '800' },
  fsCounter:      { position: 'absolute', top: 60, left: 20, color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700', zIndex: 10 },
  fsContent:      { flexDirection: 'row', alignItems: 'center', width: '100%', height: '100%' },
  fsArrow:        { width: 50, height: '60%', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  fsArrowTxt:     { color: '#fff', fontSize: 48, fontWeight: '300', opacity: 0.8 },
  fsImage:        { flex: 1, height: '70%' },
})