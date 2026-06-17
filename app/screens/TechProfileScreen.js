import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { onValue, ref } from 'firebase/database'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { db } from '../firebase/config'
import SettingsModal from '../../components/SettingsModal'

export default function TechProfileScreen() {
  const router = useRouter()

  const [name, setName]           = useState('Technician')
  const [phone, setPhone]         = useState('')
  const [location, setLocation]   = useState('')
  const [pincode, setPincode]     = useState('')
  const [exp, setExp]             = useState('')
  const [photo, setPhoto]         = useState(null)
  const [rating]                  = useState(4.8)
  const [totalJobs, setTotal]     = useState(0)
  const [notifications, setNotifications] = useState(true)
  const [isOnline, setIsOnline]   = useState(true)
  const [showSettings, setShowSettings]   = useState(false)
  const ordersUnsub = useRef(null)

  useEffect(() => {
    loadProfile()
    return () => {
      if (ordersUnsub.current) ordersUnsub.current()
    }
  }, [])

  const loadProfile = async () => {
    const n  = await AsyncStorage.getItem('techName')
    const p  = await AsyncStorage.getItem('techPhone')
    const l  = await AsyncStorage.getItem('techLocation')
    const pi = await AsyncStorage.getItem('techPincode')
    const e  = await AsyncStorage.getItem('techExp')
    const ph = await AsyncStorage.getItem('techPhoto')
    if (n)  setName(n)
    if (p)  setPhone(p)
    if (l)  setLocation(l)
    if (pi) setPincode(pi)
    if (e)  setExp(e)
    if (ph) setPhoto(ph)

    // ── Pass phone directly so we don't rely on state being updated yet ──────
    if (p) loadJobs(p)
  }

  // ── FIXED: filter jobs by THIS tech's phone number only ─────────────────────
  const loadJobs = (myPhone) => {
    ordersUnsub.current = onValue(ref(db, 'orders'), snap => {
      if (!snap.exists()) {
        setTotal(0)
        return
      }
      let total = 0

      snap.forEach(child => {
        const o = child.val()
        // Only count jobs that were accepted/completed by this tech
        if (o.techPhone === myPhone && o.status === 'completed') {
          total++
        }
      })

      setTotal(total)
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
            await AsyncStorage.setItem('techPhoto', result.assets[0].uri)
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
            await AsyncStorage.setItem('techPhoto', result.assets[0].uri)
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
          const keys = ['techPhone','techName','techLocation','techPincode','techExp','techSkills','techPhoto','currentOrderId','digilockerVerified','digilockerName']
          await AsyncStorage.multiRemove(keys)
          router.replace('/screens/RoleScreen')
        }
      }
    ])
  }

  const MENU = [
    { icon: '📋', label: 'Job History',    sub: `${totalJobs} jobs done`, onPress: () => router.push('/screens/JobHistoryScreen') },
    { icon: '⭐', label: 'My Rating',      sub: `${rating} stars`,         onPress: () => Alert.alert('Rating', `Your rating: ${rating} ⭐`) },
    { icon: '🏆', label: 'My Rewards',     sub: null,                      onPress: () => Alert.alert('Rewards', 'Coming Soon!') },
    { icon: '💳', label: 'Payment Info', sub: 'Bank & UPI details', onPress: () => Alert.alert('Payment', 'Add your UPI ID to receive payments directly!\nUPI ID: yourname@upi') },
    { icon: '📊', label: 'Performance',    sub: 'View your stats',         onPress: () => Alert.alert('Stats', `Jobs: ${totalJobs}\nRating: ${rating}`) },
    { icon: '🔔', label: 'Notifications',  sub: null,                      toggle: true, value: notifications, onToggle: setNotifications },
    { icon: '🛡️', label: 'Safety',         sub: null,                      onPress: () => Alert.alert('Safety', 'Your safety matters!') },
    { icon: '❓', label: 'Help & Support', sub: 'dotor.india@gmail.com', onPress: () => Linking.openURL('mailto:dotor.india@gmail.com') },
    { icon: '⚙️', label: 'Settings',       sub: 'Profile, Security & more', onPress: () => setShowSettings(true) },
    { icon: '📄', label: 'Privacy Policy', sub: null,                      onPress: () => Alert.alert('Privacy', 'Your data is secure!') },
    { icon: '🚪', label: 'Logout',         sub: null,                      onPress: logout, danger: true },
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
        <TouchableOpacity onPress={pickPhoto} style={s.photoWrap}>
          {photo
            ? <Image source={{ uri: photo }} style={s.photo} />
            : <View style={s.photoPlaceholder}><Text style={{ fontSize: 40 }}>👨‍🔧</Text></View>
          }
          <View style={s.cameraDot}><Text style={{ fontSize: 10 }}>📷</Text></View>
        </TouchableOpacity>

        <Text style={s.profileName}>{name}</Text>
        <Text style={s.profilePhone}>📱 +91 {phone || 'Add phone'}</Text>
        <Text style={s.profileLoc}>📍 {location || 'Add location'}</Text>
        {pincode ? <Text style={s.profileLoc}>📮 Pincode: {pincode}</Text> : null}
        <Text style={s.profileExp}>⭐ {exp || 'Experience not set'}</Text>

        <View style={s.onlineRow}>
          <Text style={s.onlineLabel}>Status:</Text>
          <Switch
            value={isOnline}
            onValueChange={setIsOnline}
            trackColor={{ false: '#ddd', true: '#FF6B00' }}
            thumbColor="#fff"
          />
          <Text style={[s.onlineStatus, { color: isOnline ? '#2e7d32' : '#c62828' }]}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </Text>
        </View>

        <View style={s.ratingRow}>
          <Text style={s.starIcon}>⭐</Text>
          <Text style={s.ratingTxt}>{rating} Rating</Text>
          <Text style={s.ratingCount}>({totalJobs} jobs)</Text>
        </View>
      </View>

      {/* STATS */}
      <Text style={s.sectionTitle}>📊 My Stats</Text>
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statNum}>{totalJobs}</Text>
          <Text style={s.statLabel}>Total Jobs</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statNum}>{rating}</Text>
          <Text style={s.statLabel}>Rating</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statNum}>100%</Text>
          <Text style={s.statLabel}>Acceptance</Text>
        </View>
      </View>



      {/* MENU */}
      <Text style={s.sectionTitle}>⚙️ More Options</Text>
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
                <Text style={[s.menuLabel, item.danger && s.menuDanger]}>{item.label}</Text>
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

      {/* SETTINGS MODAL */}
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} role="tech" />

      <View style={s.version}>
        <Text style={s.versionTxt}>🔧 DoToR v1.0.0</Text>
        <Text style={s.versionSub}>We are the Doctor of your Device</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f0f0f0' },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 55, backgroundColor: '#f0f0f0' },
  back:             { fontSize: 24, color: '#1A3A6B', fontWeight: '700' },
  headerTitle:      { fontSize: 22, fontWeight: '800', color: '#111' },
  profileCard:      { backgroundColor: '#fff', borderRadius: 18, marginHorizontal: 15, marginBottom: 12, padding: 22, alignItems: 'center', elevation: 4 },
  photoWrap:        { position: 'relative', marginBottom: 12 },
  photo:            { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#FF6B00' },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FF6B00' },
  cameraDot:        { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FF6B00', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  profileName:      { fontSize: 22, fontWeight: '800', color: '#111' },
  profilePhone:     { fontSize: 13, color: '#888', marginTop: 4, fontWeight: '600' },
  profileLoc:       { fontSize: 13, color: '#888', marginTop: 3, fontWeight: '600' },
  profileExp:       { fontSize: 13, color: '#888', marginTop: 3, fontWeight: '600' },
  onlineRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, backgroundColor: '#f5f5f5', padding: 12, borderRadius: 12, width: '100%' },
  onlineLabel:      { fontSize: 14, fontWeight: '700', color: '#555' },
  onlineStatus:     { fontSize: 14, fontWeight: '800', marginLeft: 5 },
  ratingRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: '#fff5ee', padding: 10, borderRadius: 12, width: '100%' },
  starIcon:         { fontSize: 22 },
  ratingTxt:        { fontSize: 16, fontWeight: '800', color: '#FF6B00' },
  ratingCount:      { fontSize: 12, color: '#888', fontWeight: '600' },
  sectionTitle:     { fontSize: 16, fontWeight: '800', color: '#111', marginHorizontal: 15, marginTop: 18, marginBottom: 10 },
  statsRow:         { flexDirection: 'row', gap: 10, marginHorizontal: 15, marginBottom: 5 },
  statCard:         { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 2 },
  statNum:          { fontSize: 20, fontWeight: '800', color: '#1A3A6B' },
  statLabel:        { fontSize: 11, color: '#888', fontWeight: '600', marginTop: 3 },
  menuCard:         { backgroundColor: '#fff', borderRadius: 18, marginHorizontal: 15, marginBottom: 12, overflow: 'hidden', elevation: 3 },
  menuItem:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  menuLeft:         { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuIconBox:      { width: 42, height: 42, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  menuIconDanger:   { backgroundColor: '#ffebeb' },
  menuIcon:         { fontSize: 20 },
  menuLabel:        { fontSize: 15, fontWeight: '700', color: '#111' },
  menuDanger:       { color: '#ff4444' },
  menuSub:          { fontSize: 12, color: '#FF6B00', fontWeight: '600', marginTop: 2 },
  chevron:          { fontSize: 22, color: '#ccc', fontWeight: '600' },
  version:          { alignItems: 'center', padding: 20 },
  versionTxt:       { fontSize: 14, fontWeight: '700', color: '#888' },
  versionSub:       { fontSize: 12, color: '#aaa', marginTop: 4 },
})