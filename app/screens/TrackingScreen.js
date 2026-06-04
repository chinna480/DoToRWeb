import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { onValue, ref, set } from 'firebase/database'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { db } from '../firebase/config'
import { calcDistance } from '../utils/distance'

// MapView is optional — only load if available
// Platform guard prevents Metro from resolving native-only module on web bundles
let MapView = null, Marker = null, Polyline = null
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps')
    MapView  = Maps.default
    Marker   = Maps.Marker
    Polyline = Maps.Polyline
  } catch (e) {
    MapView = null
  }
}

export default function TrackingScreen() {
  const router = useRouter()
  const [activeTab, setActiveTab]   = useState('home')
  const [loading, setLoading]       = useState(true)

  const [custLat, setCustLat]     = useState(17.3850)
  const [custLng, setCustLng]     = useState(78.4867)
  const [techLat, setTechLat]     = useState(null)
  const [techLng, setTechLng]     = useState(null)
  const [distance, setDistance]   = useState('--')
  const [eta, setEta]             = useState('--')
  const [techName, setTechName]   = useState('Connecting...')
  const [techPhone, setTechPhone] = useState('')
  const [statusMsg, setStatusMsg] = useState('⏳ Waiting for technician...')
  const [brand, setBrand]         = useState('-')
  const [repair, setRepair]       = useState('-')
  const [location, setLocation]   = useState('-')
  const [jobDone, setJobDone]     = useState(false)
  const [orderId, setOrderId]     = useState('')
  const [custName, setCustName]   = useState('Customer')
  const [mapError, setMapError]   = useState(false)

  const watchRef    = useRef(null)
  const unsubsRef   = useRef([])
  const mounted     = useRef(true)
  const custPosRef  = useRef({ lat: 17.3850, lng: 78.4867 })
  const techPosRef  = useRef(null)
  const orderIdRef    = useRef('')
  const techLocUnsubRef = useRef(null)

  useEffect(() => {
    mounted.current = true
    init()
    return () => {
      mounted.current = false
      if (watchRef.current) {
        watchRef.current.remove()
        watchRef.current = null
      }
      unsubsRef.current.forEach(fn => { try { fn() } catch(e) {} })
      unsubsRef.current = []
      techLocUnsubRef.current = null
    }
  }, [])

  const init = async () => {
    try {
      const [o, b, r, l, n] = await Promise.all([
        AsyncStorage.getItem('lastOrderId'),
        AsyncStorage.getItem('lastBrand'),
        AsyncStorage.getItem('lastRepair'),
        AsyncStorage.getItem('custLocation'),
        AsyncStorage.getItem('lastCustName').then(v => v || AsyncStorage.getItem('custName') || 'Customer'),
      ])
      if (o) { setOrderId(o); orderIdRef.current = o }
      if (b)  setBrand(b)
      if (r)  setRepair(r)
      if (l)  setLocation(l)
      if (n)  setCustName(n)

      await startGPS()
      startListeners()
    } catch (e) {
      console.log('TrackingScreen init error:', e)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  const startGPS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 6000, distanceInterval: 10 },
        pos => {
          if (!mounted.current) return
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          custPosRef.current = { lat, lng }
          setCustLat(lat)
          setCustLng(lng)
          set(ref(db, 'custLocation'), { lat, lng }).catch(() => {})
        }
      )
    } catch (e) {
      console.log('GPS error:', e)
    }
  }

  const startListeners = () => {
    const u2 = onValue(ref(db, 'orders'), snap => {
      if (!mounted.current || !snap.exists()) return
      snap.forEach(child => {
        const o = child.val()
        if (child.key === orderIdRef.current) {
          if (o.techName) {
            setTechName(o.techName)
          }
          if (o.techPhone) {
            setTechPhone(o.techPhone)
            // Listen to per-tech location instead of global techLocation
            const cleanPhone = o.techPhone.replace('+91', '').replace(/^0+/, '')
            if (techLocUnsubRef.current) {
              try { techLocUnsubRef.current() } catch(e) {}
            }
            techLocUnsubRef.current = onValue(ref(db, 'techsOnline/' + cleanPhone), snap => {
              if (!mounted.current) return
              if (snap.exists()) {
                const { lat, lng } = snap.val()
                techPosRef.current = { lat, lng }
                setTechLat(lat)
                setTechLng(lng)
                setStatusMsg('🛵 Technician is on the way!')
              }
            })
            unsubsRef.current.push(techLocUnsubRef.current)
          }
          if (o.status === 'completed') {
            setJobDone(true)
            setStatusMsg('✅ Repair Completed!')
          }
        }
      })
    })
    unsubsRef.current.push(u2)
  }

  const recalcDistance = (custPos, techPos) => {
    if (!custPos || !techPos) return
    const d = parseFloat(calcDistance(custPos.lat, custPos.lng, techPos.lat, techPos.lng))
    setDistance(d + ' km')
    const SPEED = 0.3 // km/min (~18 km/h — realistic city speed)
    const etaMins = Math.round(d / SPEED)
    setEta('~' + Math.max(1, etaMins) + ' mins')
  }

  // Recalculate distance whenever GPS or tech location changes
  useEffect(() => {
    if (custLat && techLat && isFinite(custLat) && isFinite(techLat)) {
      recalcDistance({ lat: custLat, lng: custLng }, { lat: techLat, lng: techLng })
    }
  }, [custLat, custLng, techLat, techLng])

  const callTech = () => {
    if (techPhone) {
      Linking.openURL('tel:+91' + techPhone).catch(() => Alert.alert('Error', 'Cannot make call!'))
    } else {
      Alert.alert('Not Available', 'Technician phone not available yet! Please wait.')
    }
  }

  const STEPS = [
    { label: '✅ Order Confirmed',       done: true },
    { label: '🚗 Technician On The Way', done: !!techLat },
    { label: '🔧 Repair In Progress',    done: jobDone },
    { label: '✅ Repair Done!',          done: jobDone },
  ]

  const TABS = [
    { key: 'home',     icon: '🏠', label: 'Home' },
    { key: 'orders',   icon: '📋', label: 'Orders' },
    { key: 'profile',  icon: '👤', label: 'Profile' },
  ]

  const switchTab = (key) => {
    if (key === 'home') { setActiveTab('home'); return }
    if (key === 'orders') { router.push('/screens/HomeScreen'); return }
    if (key === 'profile') { router.push('/screens/CustomerProfileScreen'); return }
  }

  // ── Show loading spinner while initializing ───────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 50, marginBottom: 20 }}>🗺️</Text>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A3A6B' }}>Loading tracking...</Text>
        <Text style={{ fontSize: 12, color: '#888', marginTop: 5 }}>Getting things ready</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>🛵 Live Tracking</Text>
            <Text style={s.sub}>{statusMsg}</Text>
          </View>
          <View style={[s.pill, { backgroundColor: jobDone ? '#2e7d32' : '#FF6B00' }]}>
            <Text style={s.pillTxt}>{jobDone ? '✅ Done' : '🟢 Live'}</Text>
          </View>
        </View>

        {/* MAP or PLACEHOLDER */}          {/* MAP with coordinate validation — prevents native crashes from NaN/invalid coords */}
          {!mapError && MapView && Marker && isFinite(custLat) && isFinite(custLng) ? (
            <MapView
              style={s.map}
              initialRegion={{
                latitude:       parseFloat(custLat) || 17.3850,
                longitude:      parseFloat(custLng) || 78.4867,
                latitudeDelta:  0.05,
                longitudeDelta: 0.05,
              }}
              onError={() => setMapError(true)}
            >
              <Marker coordinate={{ latitude: parseFloat(custLat), longitude: parseFloat(custLng) }} title="🏠 Your Location" />
              {techLat && isFinite(techLat) && isFinite(techLng) && (
                <Marker coordinate={{ latitude: parseFloat(techLat), longitude: parseFloat(techLng) }} title="🛵 Technician" pinColor="#FF6B00" />
              )}
              {techLat && isFinite(techLat) && isFinite(techLng) && Polyline && (
                <Polyline
                  coordinates={[
                    { latitude: parseFloat(custLat), longitude: parseFloat(custLng) },
                    { latitude: parseFloat(techLat), longitude: parseFloat(techLng) },
                  ]}
                  strokeColor="#FF6B00"
                  strokeWidth={3}
                  lineDashPattern={[8, 8]}
                />
              )}
            </MapView>
          ) : (
            <View style={s.mapPlaceholder}>
              <Text style={s.mapIcon}>🗺️</Text>
              <Text style={s.mapTxt}>{mapError ? '⚠️ Map unavailable' : techLat ? '🛵 Technician is moving towards you!' : '⏳ Waiting for technician...'}</Text>
            </View>
          )}

        <View style={s.content}>

          {/* DISTANCE BANNER */}
          <View style={s.distBanner}>
            <View>
              <Text style={s.distLabel}>Distance</Text>
              <Text style={s.distVal}>{distance}</Text>
            </View>
            <View style={s.etaPill}>
              <Text style={s.etaTxt}>ETA: {eta}</Text>
            </View>
          </View>

          {/* LOCATION CARDS */}
          <View style={s.locRow}>
            <View style={s.locCard}>
              <Text style={s.locIcon}>🏠</Text>
              <Text style={s.locLabel}>YOUR LOCATION</Text>
              <Text style={s.locName}>{location}</Text>
            </View>
            <View style={s.locCard}>
              <Text style={s.locIcon}>🛵</Text>
              <Text style={s.locLabel}>TECHNICIAN</Text>
              <Text style={s.locName}>{techLat ? 'On the way' : 'Waiting...'}</Text>
            </View>
          </View>

          {/* TECHNICIAN CARD */}
          <View style={s.card}>
            <Text style={s.cardTitle}>YOUR TECHNICIAN</Text>
            <View style={s.techRow}>
              <View style={s.techAvatar}><Text style={{ fontSize: 26 }}>👨‍🔧</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.techName}>{techName}</Text>
                <Text style={s.techSub}>⭐ Verified Expert Technician</Text>
              </View>
              <View style={s.ratingBadge}><Text style={s.ratingTxt}>⭐ 4.8</Text></View>
            </View>
          </View>

          {/* ORDER DETAILS */}
          <View style={s.card}>
            <Text style={s.cardTitle}>ORDER DETAILS</Text>
            {[['Device', brand], ['Repair', repair], ['Location', location]].map(([l, v]) => (
              <View key={l} style={s.infoRow}>
                <Text style={s.infoLabel}>{l}</Text>
                <Text style={s.infoVal}>{v || '-'}</Text>
              </View>
            ))}
          </View>

          {/* STATUS STEPS */}
          <View style={s.card}>
            <Text style={s.cardTitle}>LIVE STATUS</Text>
            {STEPS.map((step, i) => (
              <View key={i} style={s.step}>
                <View style={[s.dot, step.done ? s.dotDone : i === STEPS.findIndex(s => !s.done) ? s.dotActive : s.dotPending]} />
                <Text style={s.stepLabel}>{step.label}</Text>
              </View>
            ))}
          </View>

          {/* CALL BUTTON */}
          <TouchableOpacity style={s.callBtn} onPress={callTech}>
            <Text style={s.callTxt}>📞 Call Technician</Text>
          </TouchableOpacity>

          {/* CHAT & REVIEW BUTTONS */}
          <View style={s.actionRow}>
            <TouchableOpacity
              style={s.chatBtnTrack}
              onPress={() => {
                const name = techName || 'Technician'
                const oid = orderId || 'current'
                router.push(`/screens/ChatScreen?orderId=${oid}&role=cust&techName=${encodeURIComponent(name)}&customerName=${encodeURIComponent(custName)}`)
              }}
            >
              <Text style={s.chatBtnTxt}>💬 Chat with Technician</Text>
            </TouchableOpacity>

            {jobDone && (
              <TouchableOpacity style={s.reviewBtn} onPress={() => router.push('/screens/ReviewScreen')}>
                <Text style={s.reviewTxt}>⭐ Rate Your Experience</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 90 }} />
        </View>
      </ScrollView>

      {/* BOTTOM TAB BAR */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tabItem, activeTab === tab.key && s.tabItemActive]}
            onPress={() => switchTab(tab.key)}
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
  container:      { flex: 1, backgroundColor: '#f5f5f5' },
  header:         { backgroundColor: '#FF6B00', padding: 20, paddingTop: Platform.OS === 'ios' ? 55 : 45, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:          { fontSize: 20, fontWeight: '800', color: '#fff' },
  sub:            { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 3 },
  pill:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pillTxt:        { color: '#fff', fontSize: 11, fontWeight: '800' },
  map:            { width: '100%', height: 260 },
  mapPlaceholder: { height: 200, backgroundColor: '#1A3A6B', alignItems: 'center', justifyContent: 'center' },
  mapIcon:        { fontSize: 50 },
  mapTxt:         { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 10, textAlign: 'center', paddingHorizontal: 20 },
  content:        { padding: 15 },
  distBanner:     { backgroundColor: '#1A3A6B', borderRadius: 16, padding: 15, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  distLabel:      { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
  distVal:        { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 2 },
  etaPill:        { backgroundColor: '#FF6B00', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  etaTxt:         { color: '#fff', fontSize: 12, fontWeight: '800' },
  locRow:         { flexDirection: 'row', gap: 10, marginBottom: 12 },
  locCard:        { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 2 },
  locIcon:        { fontSize: 28 },
  locLabel:       { fontSize: 10, fontWeight: '800', color: '#888', marginTop: 4, letterSpacing: 1 },
  locName:        { fontSize: 12, fontWeight: '800', color: '#1A3A6B', marginTop: 3, textAlign: 'center' },
  card:           { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 12, elevation: 2 },
  cardTitle:      { fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 1, marginBottom: 12 },
  techRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  techAvatar:     { width: 50, height: 50, backgroundColor: '#1A3A6B', borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  techName:       { fontSize: 15, fontWeight: '800', color: '#1A3A6B' },
  techSub:        { fontSize: 12, color: '#888', marginTop: 2 },
  ratingBadge:    { backgroundColor: '#fff5ee', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  ratingTxt:      { color: '#FF6B00', fontSize: 12, fontWeight: '800' },
  infoRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoLabel:      { color: '#888', fontWeight: '600', fontSize: 13 },
  infoVal:        { color: '#1A3A6B', fontWeight: '800', fontSize: 13 },
  step:           { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  dot:            { width: 14, height: 14, borderRadius: 7 },
  dotDone:        { backgroundColor: '#FF6B00' },
  dotActive:      { backgroundColor: '#1A3A6B' },
  dotPending:     { backgroundColor: '#ddd' },
  stepLabel:      { fontSize: 13, fontWeight: '700', color: '#1A3A6B' },
  callBtn:        { backgroundColor: '#1A3A6B', padding: 15, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  callTxt:        { color: '#fff', fontSize: 16, fontWeight: '800' },
  actionRow:      { gap: 10, marginBottom: 20 },
  chatBtnTrack:   { backgroundColor: '#FF6B00', padding: 15, borderRadius: 14, alignItems: 'center' },
  chatBtnTxt:     { color: '#fff', fontSize: 16, fontWeight: '800' },
  reviewBtn:      { backgroundColor: '#2e7d32', padding: 15, borderRadius: 14, alignItems: 'center' },
  reviewTxt:      { color: '#fff', fontSize: 16, fontWeight: '800' },

  // ── Bottom Tab Bar ──
  tabBar:        { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#fff', paddingBottom: 25, paddingTop: 8, elevation: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  tabItem:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, position: 'relative' },
  tabItemActive: {},
  tabIcon:       { fontSize: 22, opacity: 0.5 },
  tabIconActive: { opacity: 1 },
  tabLabel:      { fontSize: 10, fontWeight: '600', color: '#888', marginTop: 2 },
  tabLabelActive:{ color: '#FF6B00', fontWeight: '800' },
  tabIndicator:  { position: 'absolute', top: -1, width: 24, height: 3, backgroundColor: '#FF6B00', borderRadius: 2, alignSelf: 'center' },
})