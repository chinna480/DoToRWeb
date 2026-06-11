import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { onValue, ref, set } from 'firebase/database'
import { Component, useEffect, useRef, useState } from 'react'
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

// ═══════════════════════════════════════════════════════════════════════════
// Local error boundary — catches rendering crashes so the app doesn't close
// ═══════════════════════════════════════════════════════════════════════════
class TrackingErrorBoundary extends Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error) { console.error('TrackingScreen crash:', error?.message) }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <Text style={{ fontSize: 50, marginBottom: 16 }}>🗺️</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A3A6B', marginBottom: 8 }}>Tracking Unavailable</Text>
          <Text style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24 }}>
            {this.state.error?.message || 'Something went wrong loading the tracking screen.'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#FF6B00', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>🔄 Retry</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Safe map error boundary — catches JS rendering errors from react-native-maps
// ═══════════════════════════════════════════════════════════════════════════
class MapErrorBoundary extends Component {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  componentDidCatch(error) { console.error('MapView crash:', error?.message) }
  render() {
    if (this.state.crashed) {
      return (
        <View style={{ height: 200, backgroundColor: '#1A3A6B', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 50 }}>🗺️</Text>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 10, textAlign: 'center', paddingHorizontal: 20 }}>
            Map temporarily unavailable
          </Text>
        </View>
      )
    }
    return this.props.children
  }
}

export default function TrackingScreen() {
  const router = useRouter()
  const [activeTab, setActiveTab]   = useState('home')

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
  const [modelName, setModelName]   = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation]   = useState('-')
  const [jobDone, setJobDone]     = useState(false)
  const [orderId, setOrderId]     = useState('')
  const [custName, setCustName]   = useState('Customer')

  // ── Lazy-loaded map components (loaded AFTER first render to avoid module crash) ──
  const [mapLoaded, setMapLoaded]   = useState(false)
  const [MapViewCmp, setMapViewCmp] = useState(null)
  const [MarkerCmp, setMarkerCmp]   = useState(null)
  const [PolylineCmp, setPolylineCmp] = useState(null)

  // Load react-native-maps lazily — module-level require can crash before
  // React error boundaries catch it. Loading here ensures the component
  // renders safely even if the map module fails.
  useEffect(() => {
    let cancelled = false
    try {
      const Maps = require('react-native-maps')
      if (!cancelled) {
        setMapViewCmp(() => Maps.default || null)
        setMarkerCmp(() => Maps.Marker || null)
        setPolylineCmp(() => Maps.Polyline || null)
        setMapLoaded(true)
      }
    } catch (e) {
      console.log('react-native-maps not available, using placeholder:', e?.message)
      if (!cancelled) setMapLoaded(true)
    }
    return () => { cancelled = true }
  }, [])

  const watchRef    = useRef(null)
  const unsubsRef   = useRef([])
  const mounted     = useRef(true)
  const custPosRef  = useRef({ lat: 17.3850, lng: 78.4867 })
  const techPosRef  = useRef(null)
  const orderIdRef  = useRef('')

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
    }
  }, [])

  const init = async () => {
    try {
      const o  = await AsyncStorage.getItem('lastOrderId')
      const b  = await AsyncStorage.getItem('lastBrand')
      const m  = await AsyncStorage.getItem('lastModelName')
      const d  = await AsyncStorage.getItem('lastDescription')
      const l  = await AsyncStorage.getItem('custLocation')
      const n  = await AsyncStorage.getItem('lastCustName') || await AsyncStorage.getItem('custName') || 'Customer'

      // Set orderIdRef BEFORE calling startListeners so the listener
      // knows which order to watch.
      if (o) { setOrderId(o); orderIdRef.current = o }
      if (b)  setBrand(b)
      if (m)  setModelName(m)
      if (d)  setDescription(d)
      if (l)  setLocation(l)
      if (n)  setCustName(n)

      if (!o) {
        console.warn('TrackingScreen: No lastOrderId found in AsyncStorage!')
        return
      }

      await startGPS()
      startListeners()
    } catch (e) {
      console.log('TrackingScreen init error:', e)
    }
  }

  const startGPS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 6000, distanceInterval: 10 },
        pos => {
          try {
            if (!mounted.current) return
            // Guard: validate position object before accessing properties
            if (!pos || !pos.coords || typeof pos.coords.latitude !== 'number' || typeof pos.coords.longitude !== 'number') return
            const lat = pos.coords.latitude
            const lng = pos.coords.longitude
            custPosRef.current = { lat, lng }
            setCustLat(lat)
            setCustLng(lng)
            if (orderIdRef.current) {
              set(ref(db, `orders/${orderIdRef.current}/custLocation`), { lat, lng }).catch(() => {})
            }
          } catch (e) {
            console.log('GPS position callback error:', e)
          }
        }
      )
    } catch (e) {
      console.log('GPS error:', e)
    }
  }

  const startListeners = () => {
    // Safety: guard against empty orderId — prevents invalid Firebase paths
    const oid = orderIdRef.current
    if (!oid || typeof oid !== 'string' || oid.trim() === '') {
      console.log('TrackingScreen: No valid orderId to listen to, skipping listeners')
      return
    }

    try {
      const u1 = onValue(ref(db, `orders/${oid}/techLocation`), snap => {
        try {
          if (!mounted.current || !snap.exists()) return
          const val = snap.val()
          if (!val || typeof val.lat !== 'number' || typeof val.lng !== 'number') return
          const { lat, lng } = val
          techPosRef.current = { lat, lng }
          setTechLat(lat)
          setTechLng(lng)
          setStatusMsg('🛵 Technician is on the way!')
        } catch (e) {
          console.log('techLocation data callback error:', e)
        }
      }, err => console.log('techLocation listener error:', err))
      unsubsRef.current.push(u1)
    } catch (e) {
      console.log('techLocation listener setup error:', e)
    }

    try {
      const u2 = onValue(ref(db, `orders/${oid}`), snap => {
        try {
          if (!mounted.current || !snap.exists()) return
          const o = snap.val()
          if (!o) return
          if (o.techName) {
            setTechName(o.techName)
            if (o.techPhone) setTechPhone(o.techPhone)
          }
          if (o.modelName) setModelName(o.modelName)
          if (o.description) setDescription(o.description)
          if (o.location) setLocation(o.location)
          if (o.status === 'completed') {
            setJobDone(true)
            setStatusMsg('✅ Repair Completed!')
          } else {
            setJobDone(false)
          }
        } catch (e) {
          console.log('order data callback error:', e)
        }
      }, err => console.log('order listener error:', err))
      unsubsRef.current.push(u2)
    } catch (e) {
      console.log('orders listener setup error:', e)
    }
  }

  const recalcDistance = (custPos, techPos) => {
    if (!custPos || !techPos) return
    const d = parseFloat(calcDistance(custPos.lat, custPos.lng, techPos.lat, techPos.lng))
    if (isNaN(d)) return
    setDistance(d + ' km')
    const SPEED = 0.3 // km/min (~18 km/h — realistic city speed)
    const etaMins = Math.round(d / SPEED)
    setEta('~' + Math.max(1, etaMins) + ' mins')
  }

  // Recalculate distance whenever GPS or tech location changes
  useEffect(() => {
    if (custLat && techLat) {
      recalcDistance({ lat: custLat, lng: custLng }, { lat: techLat, lng: techLng })
    }
  }, [custLat, custLng, techLat, techLng])

  const callTech = () => {
    if (techPhone) {
      const cleanPhone = techPhone.replace(/[^0-9]/g, '')
      if (cleanPhone.length < 10) {
        Alert.alert('Not Available', 'Technician phone number is not valid yet.')
        return
      }
      Linking.openURL('tel:+91' + cleanPhone).catch(() => Alert.alert('Error', 'Cannot make call!'))
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

  return (
    <TrackingErrorBoundary>
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

        {/* MAP or PLACEHOLDER — MapView is loaded lazily to prevent module-level crashes */}
        <MapErrorBoundary>
        {mapLoaded && MapViewCmp && MarkerCmp ? (
          <MapViewCmp
            style={s.map}
            region={{
              latitude:       (custLat + (techLat || custLat)) / 2,
              longitude:      (custLng + (techLng || custLng)) / 2,
              latitudeDelta:  0.05,
              longitudeDelta: 0.05,
            }}
          >
            <MarkerCmp coordinate={{ latitude: custLat, longitude: custLng }} title="🏠 Your Location" />
            {techLat && <MarkerCmp coordinate={{ latitude: techLat, longitude: techLng }} title="🛵 Technician" pinColor="#FF6B00" />}
            {techLat && PolylineCmp && (
              <PolylineCmp
                coordinates={[
                  { latitude: custLat, longitude: custLng },
                  { latitude: techLat, longitude: techLng },
                ]}
                strokeColor="#FF6B00"
                strokeWidth={3}
                lineDashPattern={[8, 8]}
              />
            )}
          </MapViewCmp>
        ) : (
          <View style={s.mapPlaceholder}>
            <Text style={s.mapIcon}>🗺️</Text>
            <Text style={s.mapTxt}>{techLat ? '🛵 Technician is moving towards you!' : '⏳ Waiting for technician...'}</Text>
          </View>
        )}
        </MapErrorBoundary>

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
              <Text style={s.locName}>{techLat ? 'On the way' : 'Being assigned...'}</Text>
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
                {techPhone ? (
                  <Text style={s.techPhone}>📱 +91{techPhone}</Text>
                ) : null}
              </View>
              <View style={s.ratingBadge}><Text style={s.ratingTxt}>⭐ 4.8</Text></View>
            </View>
          </View>

          {/* ORDER DETAILS */}
          <View style={s.card}>
            <Text style={s.cardTitle}>ORDER DETAILS</Text>
            {[['Device', `${brand}${modelName ? ' ' + modelName : ''}`], ['Issue', description || '—'], ['Location', location]].map(([l, v]) => (
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
    </TrackingErrorBoundary>
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
  techPhone:      { fontSize: 12, color: '#FF6B00', fontWeight: '700', marginTop: 2 },
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