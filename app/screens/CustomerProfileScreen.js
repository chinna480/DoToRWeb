import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { onValue, ref } from 'firebase/database'
import { useEffect, useState } from 'react'
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { db } from '../firebase/config'

export default function CustomerProfileScreen() {
  const router = useRouter()

  const [name, setName]         = useState('Customer')
  const [phone, setPhone]       = useState('')
  const [email, setEmail]       = useState('')
  const [location, setLocation] = useState('')
  const [pincode, setPincode]   = useState('')
  const [photo, setPhoto]       = useState(null)
  const [rating]                = useState(4.8)
  const [totalOrders, setTotalOrders]   = useState(0)
  const [completedOrders, setCompleted] = useState(0)
  const [notifications, setNotifications] = useState(true)

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    const n  = await AsyncStorage.getItem('custName')
    const p  = await AsyncStorage.getItem('custPhone')
    const e  = await AsyncStorage.getItem('custEmail')
    const l  = await AsyncStorage.getItem('custLocation')
    const pi = await AsyncStorage.getItem('custPincode')
    const ph = await AsyncStorage.getItem('custPhoto')
    if (n)  setName(n)
    if (p)  setPhone(p)
    if (e)  setEmail(e)
    if (l)  setLocation(l)
    if (pi) setPincode(pi)
    if (ph) setPhoto(ph)

    // ── Pass phone directly so we don't rely on state being updated yet ──────
    if (p) loadOrders(p)
  }

  // ── FIXED: filter orders by THIS customer's phone number only ───────────────
  const loadOrders = (myPhone) => {
    onValue(ref(db, 'orders'), snap => {
      if (!snap.exists()) {
        setTotalOrders(0)
        setCompleted(0)
        return
      }
      let total = 0, done = 0
      snap.forEach(child => {
        const order = child.val()
        // Only count orders that belong to this customer
        if (order.customerPhone === myPhone) {
          total++
          if (order.status === 'completed') done++
        }
      })
      setTotalOrders(total)
      setCompleted(done)
    })
  }

  const pickPhoto = async () => {
    Alert.alert('Change Photo', 'Choose option', [
      {
        text: '📷 Camera', onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync()
          if (status !== 'granted') return
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 })
          if (!result.canceled) {
            setPhoto(result.assets[0].uri)
            await AsyncStorage.setItem('custPhoto', result.assets[0].uri)
          }
        }
      },
      {
        text: '🖼️ Gallery', onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (status !== 'granted') return
          const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 })
          if (!result.canceled) {
            setPhoto(result.assets[0].uri)
            await AsyncStorage.setItem('custPhoto', result.assets[0].uri)
          }
        }
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const logout = () => {
    Alert.alert('Logout?', 'Are you sure you want to logout?', [
      { text: 'Cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          await AsyncStorage.clear()
          router.replace('/screens/RoleScreen')
        }
      }
    ])
  }

  const MENU = [
    { icon: '❓', label: 'Help & Support',   sub: null,                   onPress: () => Alert.alert('Help', 'Email: support@dotor.in') },
    { icon: '📋', label: 'My Orders',        sub: `${totalOrders} total`, onPress: () => Alert.alert('Orders', `Total: ${totalOrders}\nCompleted: ${completedOrders}\nPending: ${totalOrders - completedOrders}`) },
    { icon: '🛡️', label: 'Safety',           sub: null,                   onPress: () => Alert.alert('Safety', 'Your safety is our priority!') },
    { icon: '🔔', label: 'Notifications',    sub: null,                   toggle: true, value: notifications, onToggle: setNotifications },
    { icon: '⚙️', label: 'Settings',         sub: null,                   onPress: () => Alert.alert('Settings', 'Coming Soon!') },
    { icon: '📄', label: 'Privacy Policy',   sub: null,                   onPress: () => Alert.alert('Privacy', 'Your data is secure!') },
    { icon: '📜', label: 'Terms of Service', sub: null,                   onPress: () => Alert.alert('Terms', 'Use DoToR responsibly!') },
    { icon: '🚪', label: 'Logout',           sub: null,                   onPress: logout, danger: true },
  ]

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* PROFILE CARD */}
      <View style={s.profileCard}>
        <TouchableOpacity style={s.profileRow}>
          <TouchableOpacity onPress={pickPhoto}>
            {photo
              ? <Image source={{ uri: photo }} style={s.photo} />
              : <View style={s.photoPlaceholder}><Text style={{ fontSize: 32 }}>👤</Text></View>
            }
            <View style={s.cameraDot}><Text style={{ fontSize: 10 }}>📷</Text></View>
          </TouchableOpacity>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{name}</Text>
            <Text style={s.profilePhone}>{phone ? `+91 ${phone}` : 'Add phone number'}</Text>
            {email    ? <Text style={s.profileSub}>{email}</Text>        : null}
            {location ? <Text style={s.profileSub}>📍 {location}</Text> : null}
            {pincode  ? <Text style={s.profileSub}>📮 Pincode: {pincode}</Text> : null}
          </View>
        </TouchableOpacity>

        <View style={s.divider} />

        <View style={s.ratingRow}>
          <Text style={s.starIcon}>⭐</Text>
          <Text style={s.ratingTxt}>{rating} My Rating</Text>
        </View>
      </View>

      {/* STATS — only this customer's orders */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statNum}>{totalOrders}</Text>
          <Text style={s.statLabel}>My Orders</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statNum}>{completedOrders}</Text>
          <Text style={s.statLabel}>Completed</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statNum}>{totalOrders - completedOrders}</Text>
          <Text style={s.statLabel}>Pending</Text>
        </View>
      </View>

      {/* MENU */}
      <View style={s.menuCard}>
        {MENU.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[s.menuItem, i === MENU.length - 1 && { borderBottomWidth: 0 }]}
            onPress={item.toggle ? undefined : item.onPress}
            activeOpacity={item.toggle ? 1 : 0.6}
          >
            <View style={s.menuLeft}>
              <View style={[s.menuIconBox, item.danger && s.menuIconDanger]}>
                <Text style={s.menuIcon}>{item.icon}</Text>
              </View>
              <View>
                <Text style={[s.menuLabel, item.danger && s.menuDangerTxt]}>{item.label}</Text>
                {item.sub && <Text style={s.menuSub}>{item.sub}</Text>}
              </View>
            </View>
            {item.toggle
              ? <Switch value={item.value} onValueChange={item.onToggle} trackColor={{ false: '#ddd', true: '#FF6B00' }} thumbColor="#fff" />
              : <Text style={[s.chevron, item.danger && { color: '#ff4444' }]}>›</Text>
            }
          </TouchableOpacity>
        ))}
      </View>

      {/* VERSION */}
      <View style={s.version}>
        <Text style={s.versionApp}>🔧 DoToR v1.0.0</Text>
        <Text style={s.versionTag}>We are the Doctor of your Device</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f0f0f0' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 55, backgroundColor: '#f0f0f0' },
  back:            { fontSize: 24, color: '#1A3A6B', fontWeight: '700' },
  headerTitle:     { fontSize: 22, fontWeight: '800', color: '#111' },
  profileCard:     { backgroundColor: '#fff', borderRadius: 18, marginHorizontal: 15, marginBottom: 12, padding: 18, elevation: 3 },
  profileRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 16 },
  photo:           { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: '#FF6B00' },
  photoPlaceholder:{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FF6B00' },
  cameraDot:       { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FF6B00', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  profileInfo:     { flex: 1 },
  profileName:     { fontSize: 18, fontWeight: '800', color: '#111' },
  profilePhone:    { fontSize: 13, color: '#888', marginTop: 3, fontWeight: '600' },
  profileSub:      { fontSize: 12, color: '#888', marginTop: 2, fontWeight: '600' },
  divider:         { height: 1, backgroundColor: '#f0f0f0', marginBottom: 14 },
  ratingRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  starIcon:        { fontSize: 24 },
  ratingTxt:       { flex: 1, fontSize: 16, fontWeight: '700', color: '#111' },
  chevron:         { fontSize: 22, color: '#ccc', fontWeight: '600' },
  statsRow:        { flexDirection: 'row', gap: 10, marginHorizontal: 15, marginBottom: 12 },
  statCard:        { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 2 },
  statNum:         { fontSize: 22, fontWeight: '800', color: '#FF6B00' },
  statLabel:       { fontSize: 11, color: '#888', fontWeight: '600', marginTop: 3 },
  menuCard:        { backgroundColor: '#fff', borderRadius: 18, marginHorizontal: 15, marginBottom: 12, overflow: 'hidden', elevation: 3 },
  menuItem:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  menuLeft:        { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuIconBox:     { width: 42, height: 42, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  menuIconDanger:  { backgroundColor: '#ffebeb' },
  menuIcon:        { fontSize: 20 },
  menuLabel:       { fontSize: 15, fontWeight: '700', color: '#111' },
  menuDangerTxt:   { color: '#ff4444' },
  menuSub:         { fontSize: 12, color: '#FF6B00', fontWeight: '600', marginTop: 2 },
  version:         { alignItems: 'center', padding: 20 },
  versionApp:      { fontSize: 14, fontWeight: '700', color: '#888' },
  versionTag:      { fontSize: 12, color: '#aaa', marginTop: 4 },
})