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
  registerForNotifications,
} from '../utils/notifications';
import { uploadImages } from '../utils/uploadImage';

const PHONE_BRANDS  = ['iPhone','Samsung','OnePlus','Redmi','Vivo','Oppo','Realme','Nokia']
const LAPTOP_BRANDS = ['Dell','HP','Lenovo','MacBook','Asus','Acer','MSI','Sony']

const STEPS = [
  { num: 1, label: 'Device',   icon: '📱' },
  { num: 2, label: 'Brand',    icon: '🏷️' },
  { num: 3, label: 'Model',    icon: '✏️' },
  { num: 4, label: 'Issue',    icon: '🔧' },
  { num: 5, label: 'Photos',   icon: '📸' },
  { num: 6, label: 'Location', icon: '📍' },
  { num: 7, label: 'Pincode',  icon: '📮' },
  { num: 8, label: 'Confirm',  icon: '✅' },
]

import { useRouter } from 'expo-router';

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
  const [locationInput, setLocationInput]   = useState('')
  const [pincodeInput, setPincodeInput]     = useState('')
  const [isSubmitting, setIsSubmitting]     = useState(false)
  const [activeTab, setActiveTab]           = useState('home')

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

  // ── Submit order ───────────────────────────────────────────────────────
  const submitOrder = async () => {
    if (!selectedDevice || !selectedBrand || !modelName.trim() || !issueDesc.trim()) {
      Alert.alert('Missing info', 'Please fill in device, brand, model, and issue.')
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

      const order = {
        customerName:       name,
        customerPhone:      phone,
        customerPushToken,
        location:           locationInput.trim(),
        pincode:            pincodeInput.trim(),
        device:             selectedDevice,
        brand:              selectedBrand,
        modelName:          modelName.trim(),
        description:        issueDesc.trim(),
        images:             imageUrls || null,
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

      await notifyCustomerBookingConfirmed(selectedBrand, modelName.trim())
      resetWizard()

      Alert.alert(
        '✅ Booking Confirmed!',
        `Device: ${selectedBrand} ${modelName}\nIssue: ${issueDesc}\n\nTrack your technician?`,
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
    setLocationInput(custLocation || '')
    setPincodeInput('')
  }

  const goNext = () => {
    if (bookingStep === 1 && !selectedDevice) { Alert.alert('Select device', 'Please select Phone or Laptop'); return }
    if (bookingStep === 2 && !selectedBrand) { Alert.alert('Select brand', 'Please select a brand'); return }
    if (bookingStep === 3 && !modelName.trim()) { Alert.alert('Enter model', 'Please enter your device model'); return }
    if (bookingStep === 4 && !issueDesc.trim()) { Alert.alert('Describe issue', 'Please describe the problem'); return }
    setBookingStep(prev => Math.min(prev + 1, 8))
  }

  const goBack = () => {
    if (bookingStep <= 1) { resetWizard(); return }
    setBookingStep(prev => prev - 1)
  }

  // ── Progress bar ──
  const renderProgressBar = () => (
    <View style={s.progressContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.progressScroll}>
        {STEPS.map((step) => (
          <View key={step.num} style={s.progressStepWrap}>
            <View style={[s.progressDot, bookingStep >= step.num && s.progressDotActive, bookingStep === step.num && s.progressDotCurrent]}>
              <Text style={s.progressDotTxt}>{step.icon}</Text>
            </View>
            <Text style={[s.progressLabel, bookingStep >= step.num && s.progressLabelActive]} numberOfLines={1}>{step.label}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${(bookingStep / 8) * 100}%` }]} />
      </View>
    </View>
  )

  const renderStep1 = () => (
    <View style={s.stepBody}>
      <Text style={s.stepTitle}>📱 Select Your Device</Text>
      <Text style={s.stepSubtitle}>What type of device needs repair?</Text>
      <View style={s.deviceGrid}>
        {[['phone','📱','Phone'],['laptop','💻','Laptop']].map(([type, icon, label]) => (
          <TouchableOpacity key={type} style={[s.deviceCard, selectedDevice === type && s.deviceCardActive]} onPress={() => { setSelectedDevice(type); if (type !== selectedDevice) setSelectedBrand(null) }}>
            <Text style={s.deviceIcon}>{icon}</Text>
            <Text style={s.deviceLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )

  const renderStep2 = () => {
    const brands = selectedDevice === 'phone' ? PHONE_BRANDS : LAPTOP_BRANDS
    return (
      <View style={s.stepBody}>
        <Text style={s.stepTitle}>🏷️ Select Brand</Text>
        <Text style={s.stepSubtitle}>Choose the brand of your {selectedDevice}</Text>
        <View style={s.brandGrid}>
          {brands.map(brand => (
            <TouchableOpacity key={brand} style={[s.brandCard, selectedBrand === brand && s.brandCardActive]} onPress={() => setSelectedBrand(brand)}>
              <Text style={s.brandIcon}>{selectedDevice === 'phone' ? '📱' : '💻'}</Text>
              <Text style={s.brandLabel}>{brand}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    )
  }

  const renderStep3 = () => (
    <View style={s.stepBody}>
      <Text style={s.stepTitle}>✏️ Device Model</Text>
      <Text style={s.stepSubtitle}>e.g. iPhone 14 Pro Max, Samsung Galaxy S24</Text>
      <View style={s.inputCard}>
        <Text style={s.inputLabel}>Model Name</Text>
        <TextInput style={s.textInput} placeholder={`e.g. ${selectedBrand} ...`} placeholderTextColor="#bbb" value={modelName} onChangeText={setModelName} maxLength={100} />
      </View>
    </View>
  )

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
      <Text style={s.stepTitle}>📸 Add Photos</Text>
      <Text style={s.stepSubtitle}>Upload photos of the damage (up to 5)</Text>
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
      <Text style={s.imageHint}>{deviceImages.length}/5 photos added {deviceImages.length === 0 ? '(optional — skip if not needed)' : ''}</Text>
    </View>
  )

  const renderStep6 = () => {
    const useCurrentLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') { Alert.alert('Permission denied', 'Allow location access to auto-fill.'); return }
      const pos = await Location.getCurrentPositionAsync({})
      const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      if (place) { setLocationInput([place.name, place.district, place.city, place.region].filter(Boolean).join(', ')) }
    }
    return (
      <View style={s.stepBody}>
        <Text style={s.stepTitle}>📍 Your Location</Text>
        <Text style={s.stepSubtitle}>Where should the technician come?</Text>
        <View style={s.inputCard}>
          <Text style={s.inputLabel}>Address / Area</Text>
          <TextInput style={s.textInput} placeholder="e.g. Madhapur, Hyderabad" placeholderTextColor="#bbb" value={locationInput} onChangeText={setLocationInput} maxLength={500} />
        </View>
        <TouchableOpacity style={s.gpsBtn} onPress={useCurrentLocation}><Text style={s.gpsBtnTxt}>📍 Use Current Location</Text></TouchableOpacity>
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

  const renderStep8 = () => (
    <View style={s.stepBody}>
      <Text style={s.stepTitle}>✅ Review & Confirm</Text>
      <Text style={s.stepSubtitle}>Check your booking details</Text>
      <View style={s.reviewCard}>
        {[['📱','Device', selectedDevice === 'phone' ? 'Phone' : 'Laptop'],['🏷️','Brand', selectedBrand],['✏️','Model', modelName || '—'],['🔧','Issue', issueDesc || '—'],['📸','Photos', deviceImages.length > 0 ? `${deviceImages.length} photo(s)` : 'None'],['📍','Location', locationInput || '—'],['📮','Pincode', pincodeInput || '—']].map(([icon, label, value], i) => (
          <View key={i} style={s.reviewRow}>
            <Text style={s.reviewIcon}>{icon}</Text>
            <View style={{ flex: 1 }}><Text style={s.reviewLabel}>{label}</Text><Text style={s.reviewValue} numberOfLines={label === 'Issue' ? 3 : 1}>{value}</Text></View>
          </View>
        ))}
      </View>
      {isSubmitting && <View style={s.submittingOverlay}><ActivityIndicator size="large" color="#FF6B00" /><Text style={s.submittingTxt}>Uploading & Booking...</Text></View>}
    </View>
  )

  const renderWizardStep = () => {
    switch (bookingStep) {
      case 1: return renderStep1()
      case 2: return renderStep2()
      case 3: return renderStep3()
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
      <Text style={s.sectionTitle}>⭐ Why DoToR?</Text>
      {[{ icon:'🏠', title:'Doorstep Service', desc:'Technician comes to your home!' },{ icon:'👀', title:'Repair in Front of You', desc:'100% transparent process!' },{ icon:'⚡', title:'Fast Service', desc:'Arrives within 60 mins!' },{ icon:'🛡️', title:'30 Day Warranty', desc:'All repairs covered!' },{ icon:'💰', title:'Best Price', desc:'No hidden charges ever!' }].map((item, i) => (
        <View key={i} style={s.whyItem}><Text style={s.whyIcon}>{item.icon}</Text><View><Text style={s.whyTitle}>{item.title}</Text><Text style={s.whyDesc}>{item.desc}</Text></View></View>
      ))}
      <View style={{ height: 90 }} />
    </ScrollView>
  )

  const renderWizard = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
  const renderOrdersTab = () => (
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
            <TouchableOpacity key={order.id || i} style={s.orderCard} onPress={() => {
              if (order.status === 'accepted' || order.status === 'pending') {
                if (order.id) {
                  AsyncStorage.setItem('lastOrderId', order.id)
                  router.push('/screens/TrackingScreen')
                }
              }
            }}>
              <View style={s.orderLeft}>
                <Text style={s.orderDevice}>📱 {order.brand} {order.modelName ? `— ${order.modelName}` : ''}</Text>
                {order.description ? <Text style={s.orderRepair}>🔧 {order.description}</Text> : null}
                <Text style={s.orderLoc}>📍 {order.location}</Text>
                {order.pincode ? <Text style={s.orderLoc}>📮 {order.pincode}</Text> : null}
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

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {bookingStep > 0 ? renderWizard() : (
        <>
          {activeTab === 'home' && renderHome()}
          {activeTab === 'orders' && renderOrdersTab()}
          <View style={s.tabBar}>
            <TouchableOpacity style={[s.tabItem, activeTab === 'home' && s.tabItemActive]} onPress={() => setActiveTab('home')}><Text style={[s.tabIcon, activeTab === 'home' && s.tabIconActive]}>🏠</Text><Text style={[s.tabLabel, activeTab === 'home' && s.tabLabelActive]}>Home</Text></TouchableOpacity>
            <TouchableOpacity style={s.tabItem} onPress={() => setBookingStep(1)}><Text style={s.tabIcon}>🔧</Text><Text style={s.tabLabel}>Book</Text></TouchableOpacity>
            <TouchableOpacity style={[s.tabItem, activeTab === 'orders' && s.tabItemActive]} onPress={() => setActiveTab('orders')}><Text style={[s.tabIcon, activeTab === 'orders' && s.tabIconActive]}>📋</Text><Text style={[s.tabLabel, activeTab === 'orders' && s.tabLabelActive]}>Orders</Text></TouchableOpacity>
            <TouchableOpacity style={s.tabItem} onPress={() => router.push('/screens/CustomerProfileScreen')}><Text style={s.tabIcon}>👤</Text><Text style={s.tabLabel}>Profile</Text></TouchableOpacity>
          </View>
        </>
      )}
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
  // Device cards
  deviceGrid:       { flexDirection: 'row', gap: 14 },
  deviceCard:       { flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 28, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', elevation: 3 },
  deviceCardActive: { borderColor: '#FF6B00', backgroundColor: '#FFF5EE' },
  deviceIcon:       { fontSize: 40 },
  deviceLabel:      { fontSize: 14, fontWeight: '800', color: '#1A3A6B', marginTop: 8 },
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
  // Tab bar
  tabBar:           { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#fff', paddingBottom: 25, paddingTop: 8, elevation: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  tabItem:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, position: 'relative' },
  tabItemActive:    {},
  tabIcon:          { fontSize: 22, opacity: 0.5 },
  tabIconActive:    { opacity: 1 },
  tabLabel:         { fontSize: 10, fontWeight: '600', color: '#888', marginTop: 2 },
  tabLabelActive:   { color: '#FF6B00', fontWeight: '800' },
})