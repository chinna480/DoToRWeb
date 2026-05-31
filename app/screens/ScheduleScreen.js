import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { push, ref } from 'firebase/database'
import { useEffect, useState } from 'react'
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { db } from '../firebase/config'
import { notifyTechsForNewOrder } from '../utils/notifications'

const TIME_SLOTS = [
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '12:00 - 13:00',
  '14:00 - 15:00',
  '15:00 - 16:00',
  '16:00 - 17:00',
  '17:00 - 18:00',
  '18:00 - 19:00',
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const PHONE_BRANDS   = ['iPhone','Samsung','OnePlus','Redmi','Vivo','Oppo','Realme','Nokia']
const LAPTOP_BRANDS  = ['Dell','HP','Lenovo','MacBook','Asus','Acer','MSI','Sony']
const PHONE_REPAIRS  = ['Screen Replacement','Battery Replacement','Charging Port','Speaker Issue','Camera Repair','Water Damage','Back Panel','Software Issue']
const LAPTOP_REPAIRS = ['Screen Replacement','Battery Replacement','Keyboard Repair','Charging Port','RAM Upgrade','Hard Disk','Overheating','Software Issue']

export default function ScheduleScreen() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [dates, setDates] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [brands, setBrands] = useState([])
  const [selectedBrand, setSelectedBrand] = useState(null)
  const [selectedRepair, setSelectedRepair] = useState(null)
  const [description, setDescription] = useState('')
  const [images, setImages] = useState([])
  const [uploadingImg, setUploadingImg] = useState(false)
  const [showDateTime, setShowDateTime] = useState(false)

  useEffect(() => {
    loadUser()
    generateDates()
  }, [])

  const loadUser = async () => {
    const n = await AsyncStorage.getItem('custName') || 'Customer'
    const p = await AsyncStorage.getItem('custPhone') || ''
    setCustomerName(n)
    setCustomerPhone(p)
  }

  const generateDates = () => {
    const days = []
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    setDates(days)
  }

  const formatDate = (d) => {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
  }

  const getAppointmentTime = (date, slot) => {
    const startHour = parseInt(slot.split(' - ')[0].split(':')[0], 10)
    const startMin = parseInt(slot.split(' - ')[0].split(':')[1], 10)
    const t = new Date(date)
    t.setHours(startHour, startMin, 0, 0)
    return t.getTime()
  }

  const selectDeviceForAppt = (type) => {
    setSelectedDevice(type)
    setBrands(type === 'phone' ? PHONE_BRANDS : LAPTOP_BRANDS)
    setSelectedBrand(null)
    setSelectedRepair(null)
    setShowDateTime(false)
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
        newImages.push(`data:image/jpeg;base64,${asset.base64}`)
      }
    })
    setImages(prev => {
      const combined = [...prev, ...newImages]
      return combined.slice(0, 5)
    })
    setUploadingImg(false)
  }

  // ── Submit Directly (available now) ──
  const submitDirectly = async () => {
    if (!selectedDevice) {
      Alert.alert('Select Device', 'Please select your device type')
      return
    }
    if (!selectedBrand) {
      Alert.alert('Select Brand', 'Please select your device brand')
      return
    }
    const repair = selectedRepair || 'General repair'
    const name = await AsyncStorage.getItem('custName') || 'Customer'
    const loc = await AsyncStorage.getItem('custLocation') || 'Your Location'
    const pincode = await AsyncStorage.getItem('custPincode') || ''
    const phone = await AsyncStorage.getItem('custPhone') || ''
    const pushToken = await AsyncStorage.getItem('pushToken') || ''

    const order = {
      customerName: name,
      customerPhone: phone,
      customerPushToken: pushToken,
      location: loc,
      pincode,
      brand: selectedBrand,
      device: selectedDevice,
      repair,
      description: description.trim(),
      images: images.length > 0 ? images : null,
      status: 'pending',
      time: new Date().toLocaleTimeString(),
      fromAppointment: true,
    }

    try {
      const newOrderRef = await push(ref(db, 'orders'), order)
      const orderId = newOrderRef.key
      await AsyncStorage.setItem('lastOrderId', orderId)

      // Notify technicians
      notifyTechsForNewOrder(order, orderId).catch(err =>
        console.error('⚠️ notifyTechsForNewOrder failed:', err)
      )

      Alert.alert(
        '✅ Order Submitted!',
        `Brand: ${selectedBrand}\nRepair: ${repair}\n\nTrack your technician?`,
        [
          { text: 'Track Now', onPress: () => router.push('/screens/TrackingScreen') },
          { text: '💬 Chat', onPress: () => router.push(`/screens/ChatScreen?orderId=${orderId}&role=cust&customerName=${encodeURIComponent(name)}&techName=`) },
          { text: 'Later', onPress: () => router.back() }
        ]
      )
    } catch (e) {
      Alert.alert('Error', 'Failed to submit order. Try again.')
    }
  }

  // ── Book Appointment (future date) ──
  const bookAppointment = async () => {
    if (!selectedDate) {
      Alert.alert('Select Date', 'Please select a date for your appointment')
      return
    }
    if (!selectedSlot) {
      Alert.alert('Select Time', 'Please select a time slot')
      return
    }

    const appointmentTime = getAppointmentTime(selectedDate, selectedSlot)
    const pushToken = await AsyncStorage.getItem('pushToken') || ''
    const repair = selectedRepair || 'Not specified'

    const appointment = {
      customerName,
      customerPhone,
      device: selectedDevice,
      brand: selectedBrand,
      repair,
      description: description.trim(),
      images: images.length > 0 ? images : null,
      date: formatDate(selectedDate),
      dateLabel: `${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`,
      timeSlot: selectedSlot,
      appointmentTime,
      reminderSent: false,
      status: 'scheduled',
      createdAt: Date.now(),
    }

    try {
      const ref_ = await push(ref(db, 'appointments'), appointment)
      await AsyncStorage.setItem('lastAppointmentId', ref_.key)

      const order = {
        customerName,
        customerPhone,
        customerPushToken: pushToken,
        location: await AsyncStorage.getItem('custLocation') || '',
        pincode: await AsyncStorage.getItem('custPincode') || '',
        brand: selectedBrand,
        device: selectedDevice,
        repair: `Appointment: ${repair}`,
        description: description.trim(),
        images: images.length > 0 ? images : null,
        status: 'pending',
        time: selectedSlot,
        appointmentTime,
        reminderSent: false,
        isAppointment: true,
      }
      await push(ref(db, 'orders'), order)

      // Schedule local notification reminders
      try {
        const remindAt = new Date(appointmentTime - 15 * 60 * 1000)
        if (remindAt > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '⏰ Appointment Reminder',
              body: `Your ${selectedBrand} appointment at ${selectedSlot} is in 15 minutes!`,
              sound: true,
              data: { screen: 'HomeScreen' },
            },
            trigger: { date: remindAt, channelId: 'dotor-channel' },
          })
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '🔔 Appointment Time!',
              body: `Your ${selectedBrand} appointment at ${selectedSlot} is starting now!`,
              sound: true,
              data: { screen: 'HomeScreen' },
            },
            trigger: { date: new Date(appointmentTime), channelId: 'dotor-channel' },
          })
        }
      } catch (notifErr) {
        console.log('Scheduling local notif failed:', notifErr.message)
      }

      Alert.alert(
        '✅ Appointment Booked!',
        `Device: ${selectedDevice}\nBrand: ${selectedBrand}\nDate: ${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}\nTime: ${selectedSlot}\n\n✅ You will receive a reminder 15 minutes before!`,
        [{ text: 'OK', onPress: () => router.back() }]
      )
    } catch (e) {
      Alert.alert('Error', 'Failed to book appointment. Try again.')
    }
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>📅 Schedule Appointment</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* STEP 1: SELECT DEVICE */}
      <Text style={s.sectionTitle}>Step 1 — Select Device</Text>
      <View style={s.deviceGrid}>
        {[['phone','📱','Phone'],['laptop','💻','Laptop']].map(([type, icon, label]) => (
          <TouchableOpacity
            key={type}
            style={[s.deviceCard, selectedDevice === type && s.deviceCardActive]}
            onPress={() => selectDeviceForAppt(type)}
          >
            <Text style={s.cardIcon}>{icon}</Text>
            <Text style={s.cardName}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* STEP 2: SELECT BRAND */}
      {brands.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Step 2 — Select Brand</Text>
          <View style={s.brandGrid}>
            {brands.map(brand => (
              <TouchableOpacity
                key={brand}
                style={[s.brandCard, selectedBrand === brand && s.brandCardActive]}
                onPress={() => setSelectedBrand(brand)}
              >
                <Text style={s.cardIcon}>{selectedDevice === 'phone' ? '📱' : '💻'}</Text>
                <Text style={s.cardName}>{brand}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* STEP 3: SELECT REPAIR CHIPS */}
      {selectedBrand && (
        <>
          <Text style={s.sectionTitle}>Step 3 — What needs repair? (optional)</Text>
          <View style={s.repairChipsRow}>
            {(selectedDevice === 'phone' ? PHONE_REPAIRS : LAPTOP_REPAIRS).map(rep => (
              <TouchableOpacity
                key={rep}
                style={[s.repairChip, selectedRepair === rep && s.repairChipActive]}
                onPress={() => setSelectedRepair(selectedRepair === rep ? null : rep)}
              >
                <Text style={[s.repairChipText, selectedRepair === rep && s.repairChipTextActive]}>{rep}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* STEP 4: DESCRIBE ISSUE */}
          <Text style={s.sectionTitle}>Step 4 — Describe the Issue</Text>
          <View style={s.descBox}>
            <Text style={s.descLabel}>📝 Tell us what's wrong (so technician knows what to bring)</Text>
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

          {/* STEP 5: UPLOAD PHOTOS */}
          <Text style={s.sectionTitle}>Step 5 — Upload Photos (optional)</Text>
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

          {/* ── ACTION BUTTONS: SUBMIT DIRECTLY or BOOK APPOINTMENT ── */}
          <Text style={s.sectionTitle}>Ready to submit?</Text>
          <View style={s.actionBtnRow}>
            <TouchableOpacity style={s.submitDirectBtn} onPress={submitDirectly}>
              <Text style={s.submitDirectIcon}>📋</Text>
              <Text style={s.submitDirectTxt}>Submit Directly</Text>
              <Text style={s.submitDirectSub}>Available now — send to technicians</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.appointmentBtn} onPress={() => setShowDateTime(true)}>
              <Text style={s.appointmentIcon}>📅</Text>
              <Text style={s.appointmentTxt}>Book Appointment</Text>
              <Text style={s.appointmentSub}>Choose date & time instead</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── APPOINTMENT DATE/TIME SECTION (shown after tapping "Book Appointment") ── */}
      {showDateTime && (
        <>
          <Text style={s.sectionTitle}>Step 6 — Select Date</Text>
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
                  <Text style={[s.dateDay, isSel && s.dateDayActive]}>
                    {DAYS[d.getDay()]}
                  </Text>
                  <Text style={[s.dateNum, isSel && s.dateNumActive]}>
                    {d.getDate()}
                  </Text>
                  <Text style={[s.dateMonth, isSel && s.dateMonthActive]}>
                    {MONTHS[d.getMonth()]}
                  </Text>
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
                <Text style={[s.slotTxt, selectedSlot === slot && s.slotTxtActive]}>
                  🕐 {slot}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* SUMMARY */}
          {selectedDate && selectedSlot && (
            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>📋 Appointment Summary</Text>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Device</Text>
                <Text style={s.summaryVal}>{selectedDevice === 'phone' ? '📱 Phone' : '💻 Laptop'}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Brand</Text>
                <Text style={s.summaryVal}>{selectedBrand}</Text>
              </View>
              {selectedRepair && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Repair</Text>
                  <Text style={s.summaryVal}>{selectedRepair}</Text>
                </View>
              )}
              {description.trim() && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Issue</Text>
                  <Text style={s.summaryVal} numberOfLines={2}>{description.trim()}</Text>
                </View>
              )}
              {images.length > 0 && (
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Photos</Text>
                  <Text style={s.summaryVal}>{images.length} uploaded</Text>
                </View>
              )}
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Date</Text>
                <Text style={s.summaryVal}>
                  {DAYS[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]}
                </Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Time</Text>
                <Text style={s.summaryVal}>{selectedSlot}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Customer</Text>
                <Text style={s.summaryVal}>{customerName}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[s.bookBtn, (!selectedDate || !selectedSlot) && s.bookBtnDisabled]}
            onPress={bookAppointment}
            disabled={!selectedDate || !selectedSlot}
          >
            <Text style={s.bookTxt}>📅 Book Appointment →</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f5' },
  header:      { backgroundColor: '#1A3A6B', padding: 20, paddingTop: Platform.OS === 'ios' ? 55 : 45, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back:        { fontSize: 24, color: '#fff', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  sectionTitle:{ fontSize: 16, fontWeight: '800', color: '#1A3A6B', marginHorizontal: 15, marginTop: 15, marginBottom: 10 },
  dateRow:     { paddingHorizontal: 15, gap: 10, paddingBottom: 5 },
  dateCard:    { width: 68, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', elevation: 2, borderWidth: 2, borderColor: 'transparent' },
  dateCardActive: { borderColor: '#FF6B00', backgroundColor: '#fff5ee' },
  dateDay:     { fontSize: 11, fontWeight: '700', color: '#888' },
  dateDayActive:{ color: '#FF6B00' },
  dateNum:     { fontSize: 22, fontWeight: '800', color: '#1A3A6B', marginTop: 4 },
  dateNumActive:{ color: '#FF6B00' },
  dateMonth:   { fontSize: 11, fontWeight: '700', color: '#888', marginTop: 2 },
  dateMonthActive:{ color: '#FF6B00' },
  slotsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 15 },
  slotBtn:     { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', elevation: 2, borderWidth: 2, borderColor: 'transparent' },
  slotBtnActive:{ borderColor: '#FF6B00', backgroundColor: '#fff5ee' },
  slotTxt:     { fontSize: 13, fontWeight: '700', color: '#1A3A6B' },
  slotTxtActive:{ color: '#FF6B00' },
  summaryCard: { backgroundColor: '#fff', borderRadius: 16, margin: 15, padding: 18, elevation: 3 },
  summaryTitle:{ fontSize: 15, fontWeight: '800', color: '#1A3A6B', marginBottom: 14 },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  summaryLabel:{ fontSize: 13, color: '#888', fontWeight: '600' },
  summaryVal:  { fontSize: 13, fontWeight: '800', color: '#1A3A6B', flex: 1, textAlign: 'right', marginLeft: 10 },
  bookBtn:     { backgroundColor: '#FF6B00', padding: 16, borderRadius: 14, alignItems: 'center', marginHorizontal: 15, marginTop: 5 },
  bookBtnDisabled: { backgroundColor: '#ddd' },
  bookTxt:     { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Device / Brand
  deviceGrid:  { flexDirection: 'row', gap: 12, marginHorizontal: 15 },
  deviceCard:  { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 22, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', elevation: 3 },
  deviceCardActive: { borderColor: '#FF6B00' },
  brandGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 15 },
  brandCard:   { width: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2, borderWidth: 2, borderColor: 'transparent' },
  brandCardActive: { borderColor: '#FF6B00' },
  cardIcon:    { fontSize: 30 },
  cardName:    { fontSize: 12, fontWeight: '800', color: '#1A3A6B', marginTop: 5, textAlign: 'center' },

  // Repair chips
  repairChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 15 },
  repairChip:  { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 2, borderColor: '#eee', elevation: 1 },
  repairChipActive:{ borderColor: '#FF6B00', backgroundColor: '#fff5ee' },
  repairChipText:{ fontSize: 12, fontWeight: '700', color: '#1A3A6B' },
  repairChipTextActive:{ color: '#FF6B00' },

  // Description
  descBox:     { backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 15, marginBottom: 10, padding: 14, elevation: 2 },
  descLabel:   { fontSize: 12, fontWeight: '700', color: '#1A3A6B', marginBottom: 8 },
  descInput:   { backgroundColor: '#f8f8f8', borderRadius: 10, padding: 12, fontSize: 13, color: '#333', minHeight: 80, textAlignVertical: 'top' },

  // Image Upload
  imgUploadBox:{ backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 15, marginBottom: 10, padding: 14, elevation: 2 },
  imgRow:      { flexDirection: 'row', gap: 12 },
  imgPickerBtn:{ flex: 1, backgroundColor: '#f8f8f8', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: '#eee', borderStyle: 'dashed' },
  imgPickerIcon:{ fontSize: 28 },
  imgPickerLabel:{ fontSize: 12, fontWeight: '800', color: '#1A3A6B', marginTop: 4 },
  imgPreviewRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  imgThumbWrap:{ position: 'relative' },
  imgThumb:    { width: 80, height: 80, borderRadius: 10, backgroundColor: '#eee' },
  imgRemoveBtn:{ position: 'absolute', top: -6, right: -6, backgroundColor: '#c62828', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  imgRemoveTxt:{ color: '#fff', fontSize: 11, fontWeight: '800' },
  imgCount:    { fontSize: 12, color: '#888', fontWeight: '600', marginTop: 8, textAlign: 'center' },
  uploadingTxt:{ fontSize: 12, color: '#FF6B00', fontWeight: '700', marginTop: 8, textAlign: 'center' },

  // Action Buttons
  actionBtnRow:{ flexDirection: 'row', gap: 12, marginHorizontal: 15, marginBottom: 10 },
  submitDirectBtn:{
    flex: 1,
    backgroundColor: '#2e7d32',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 3,
  },
  submitDirectIcon:{ fontSize: 28 },
  submitDirectTxt:{ color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 4 },
  submitDirectSub:{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  appointmentBtn:{
    flex: 1,
    backgroundColor: '#1A3A6B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 3,
  },
  appointmentIcon:{ fontSize: 28 },
  appointmentTxt:{ color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 4 },
  appointmentSub:{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },
})
