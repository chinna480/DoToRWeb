import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { push, ref } from 'firebase/database'
import { useEffect, useState } from 'react'
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { db } from '../firebase/config'

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

export default function ScheduleScreen() {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [dates, setDates] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')

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

  const isToday = (d) => {
    const today = new Date()
    return d.toDateString() === today.toDateString()
  }

  const bookAppointment = async () => {
    if (!selectedDate) {
      Alert.alert('Select Date', 'Please select a date for your appointment')
      return
    }
    if (!selectedSlot) {
      Alert.alert('Select Time', 'Please select a time slot')
      return
    }

    const appointment = {
      customerName,
      customerPhone,
      date: formatDate(selectedDate),
      dateLabel: `${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}`,
      timeSlot: selectedSlot,
      status: 'scheduled',
      createdAt: Date.now(),
    }

    try {
      const ref_ = await push(ref(db, 'appointments'), appointment)
      await AsyncStorage.setItem('lastAppointmentId', ref_.key)

      // Also create an order entry for the tech
      const order = {
        customerName,
        customerPhone,
        location: await AsyncStorage.getItem('custLocation') || '',
        pincode: await AsyncStorage.getItem('custPincode') || '',
        brand: 'Scheduled',
        repair: `Appointment: ${selectedSlot}`,
        status: 'pending',
        time: selectedSlot,
        isAppointment: true,
      }
      await push(ref(db, 'orders'), order)

      Alert.alert(
        '✅ Appointment Booked!',
        `Date: ${DAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()]}\nTime: ${selectedSlot}\n\nWe'll notify you when a technician is assigned.`,
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

      {/* INFO BANNER */}
      <View style={s.banner}>
        <Text style={s.bannerIcon}>🕐</Text>
        <View>
          <Text style={s.bannerTitle}>Choose your preferred time</Text>
          <Text style={s.bannerSub}>Select date & time slot below</Text>
        </View>
      </View>

      {/* DATE SELECTION */}
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

      {/* TIME SLOTS */}
      {selectedDate && (
        <>
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
        </>
      )}

      {/* SUMMARY */}
      {selectedDate && selectedSlot && (
        <View style={s.summaryCard}>
          <Text style={s.summaryTitle}>📋 Appointment Summary</Text>
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

      {/* BOOK BUTTON */}
      <TouchableOpacity
        style={[s.bookBtn, (!selectedDate || !selectedSlot) && s.bookBtnDisabled]}
        onPress={bookAppointment}
        disabled={!selectedDate || !selectedSlot}
      >
        <Text style={s.bookTxt}>📅 Book Appointment →</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f5' },
  header:      { backgroundColor: '#1A3A6B', padding: 20, paddingTop: Platform.OS === 'ios' ? 55 : 45, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back:        { fontSize: 24, color: '#fff', fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  banner:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', margin: 15, padding: 16, borderRadius: 14, elevation: 2 },
  bannerIcon:  { fontSize: 36 },
  bannerTitle: { fontSize: 14, fontWeight: '800', color: '#1A3A6B' },
  bannerSub:   { fontSize: 12, color: '#888', marginTop: 2 },
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
  summaryVal:  { fontSize: 13, fontWeight: '800', color: '#1A3A6B' },
  bookBtn:     { backgroundColor: '#FF6B00', padding: 16, borderRadius: 14, alignItems: 'center', marginHorizontal: 15, marginTop: 5 },
  bookBtnDisabled: { backgroundColor: '#ddd' },
  bookTxt:     { color: '#fff', fontSize: 16, fontWeight: '800' },
})
