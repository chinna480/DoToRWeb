import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'expo-router'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, Alert, Platform
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { db } from '../firebase/config'
import { ref, onValue, set } from 'firebase/database'
import * as Location from 'expo-location'
import { calcDistance } from '../utils/distance'

export default function TrackingScreen() {
  const router = useRouter()
  const [custLat, setCustLat]     = useState(null)
  const [custLng, setCustLng]     = useState(null)
  const [techLat, setTechLat]     = useState(null)
  const [techLng, setTechLng]     = useState(null)
  const [distance, setDistance]   = useState('Calculating...')
  const [eta, setEta]             = useState('--')
  const [techName, setTechName]   = useState('Connecting...')
  const [techPhone, setTechPhone] = useState('')
  const [statusMsg, setStatusMsg] = useState('⏳ Waiting for technician...')
  const [statusColor, setStatusColor] = useState('#FFA500')
  const [brand, setBrand]         = useState('-')
  const [repair, setRepair]       = useState('-')
  const [location, setLocation]   = useState('-')
  const [jobDone, setJobDone]     = useState(false)
  const [step, setStep]           = useState(0) // 0=pending 1=accepted 2=arrived 3=done

  const watchRef  = useRef(null)
  const unsubsRef = useRef([])
  const mounted   = useRef(true)

  useEffect(() => {
    mounted.current = true
    loadData()
    startGPS()
    startListeners()

    return () => {
      mounted.current = false
      if (watchRef.current) {
        watchRef.current.remove()
        watchRef.current = null
      }
      unsubsRef.current.forEach(fn => { try { fn() } catch(e) {} })
    }
  }, [])

  // Update distance when locations change
  useEffect(() => {
    if (custLat && techLat) {
      const d = calcDistance(custLat, custLng, techLat, techLng)
      setDistance(d + ' km')
      const mins = Math.max(1, Math.round(d / 0.5))
      setEta('~' + mins + ' mins')
    }
  }, [custLat, techLat])

  const loadData = async () => {
    try {
      const b = await AsyncStorage.getItem('lastBrand')
      const r = await AsyncStorage.getItem('lastRepair')
      const l = await AsyncStorage.getItem('custLocation')
      if (b) setBrand(b)
      if (r) setRepair(r)
      if (l) setLocation(l)
    } catch (e) {}
  }

  const startGPS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return

      const pos = await Location.getCurrentPositionAsync({})
      const lat  = pos.coords.latitude
      const lng  = pos.coords.longitude
      if (mounted.current) {
        setCustLat(lat)
        setCustLng(lng)
      }
      set(ref(db, 'custLocation'), { lat, lng }).catch(() => {})

      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 8000, distanceInterval: 20 },
        pos2 => {
          if (!mounted.current) return
          const la = pos2.coords.latitude
          const lo = pos2.coords.longitude
          setCustLat(la)
          setCustLng(lo)
          set(ref(db, 'custLocation'), { lat: la, lng: lo }).catch(() => {})
        }
      )
    } catch (e) {
      console.log('GPS error:', e.message)
    }
  }

  const startListeners = () => {
    // Listen technician live location
    const u1 = onValue(ref(db, 'techLocation'), snap => {
      if (!mounted.current || !snap.exists()) return
      const { lat, lng } = snap.val()
      setTechLat(lat)
      setTechLng(lng)
      if (step < 1) {
        setStep(1)
        setStatusMsg('🛵 Technician is on the way!')
        setStatusColor('#FF6B00')
      }
    })
    unsubsRef.current.push(u1)

    // Listen technician info
    const u2 = onValue(ref(db, 'techInfo'), snap => {
      if (!mounted.current || !snap.exists()) return
      const info = snap.val()
      if (info.name)  setTechName(info.name)
      if (info.phone) setTechPhone(info.phone)
      setStep(s => Math.max(s, 1))
    })
    unsubsRef.current.push(u2)

    // Listen order status
    const u3 = onValue(ref(db, 'orders'), snap => {
      if (!mounted.current || !snap.exists()) return
      snap.forEach(child => {
        const val = child.val()
        if (val.status === 'accepted' && step < 1) {
          setStep(1)
          setStatusMsg('🛵 Technician accepted your request!')
          setStatusColor('#FF6B00')
        }
        if (val.status === 'completed') {
          setStep(3)
          setStatusMsg('✅ Repair Completed!')
          setStatusColor('#2e7d32')
          setJobDone(true)
        }
      })
    })
    unsubsRef.current.push(u3)
  }

  const callTech = () => {
    if (!techPhone) {
      Alert.alert('Not Available', 'Technician phone not available yet. Please wait!')
      return
    }
    Alert.alert(
      '📞 Call Technician',
      `Call ${techName}?`,
      [
        { text: 'Cancel' },
        { text: 'Call', onPress: () => Linking.openURL('tel:+91' + techPhone) }
      ]
    )
  }

  const openMaps = () => {
    if (!techLat) {
      Alert.alert('Not Available', 'Technician location not available yet!')
      return
    }
    const url = Platform.OS === 'ios'
      ? `maps://?daddr=${techLat},${techLng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${techLat},${techLng}`
    Linking.openURL(url)
  }

  const STEPS = [
    { label: '✅ Order Confirmed',        done: step >= 0 },
    { label: '🔔 Technician Accepted',    done: step >= 1 },
    { label: '🛵 Technician On The Way',  done: step >= 1 },
    { label: '📍 Technician Arrived',     done: step >= 2 },
    { label: '🔧 Repair In Progress',     done: step >= 2 },
    { label: '✅ Repair Completed!',      done: step >= 3 },
  ]

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.title}>🛵 Live Tracking</Text>
          <Text style={s.sub}>{statusMsg}</Text>
        </View>
        <View style={[s.pill, { backgroundColor: statusColor }]}>
          <Text style={s.pillTxt}>{jobDone ? '✅ Done' : '🟢 Live'}</Text>
        </View>
      </View>

      {/* MAP PLACEHOLDER — animated status */}
      <View style={[s.mapArea, { backgroundColor: jobDone ? '#1a472a' : '#1A3A6B' }]}>
        <Text style={s.mapIcon}>{jobDone ? '✅' : techLat ? '🛵' : '⏳'}</Text>
        <Text style={s.mapTitle}>
          {jobDone
            ? 'Repair Completed!'
            : techLat
              ? 'Technician is on the way!'
              : 'Waiting for technician...'}
        </Text>
        {techLat && !jobDone && (
          <TouchableOpacity style={s.mapBtn} onPress={openMaps}>
            <Text style={s.mapBtnTxt}>🗺️ Open in Google Maps</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.content}>

        {/* DISTANCE BANNER */}
        <View style={s.distBanner}>
          <View>
            <Text style={s.distLabel}>Distance</Text>
            <Text style={s.distVal}>{techLat ? distance : '--'}</Text>
          </View>
          <View style={s.etaPill}>
            <Text style={s.etaTxt}>ETA: {techLat ? eta : 'Waiting...'}</Text>
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
            <Text style={s.locName}>{techLat ? 'On the way!' : 'Being assigned...'}</Text>
          </View>
        </View>

        {/* TECHNICIAN CARD */}
        <View style={s.card}>
          <Text style={s.cardTitle}>YOUR TECHNICIAN</Text>
          <View style={s.techRow}>
            <View style={s.techAvatar}>
              <Text style={{ fontSize: 26 }}>👨‍🔧</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.techName}>{techName}</Text>
              <Text style={s.techSub}>⭐ Verified Expert Technician</Text>
              {techPhone ? <Text style={s.techPhone}>📱 +91 {techPhone}</Text> : null}
            </View>
            <View style={s.ratingBadge}>
              <Text style={s.ratingTxt}>⭐ 4.8</Text>
            </View>
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

        {/* LIVE STATUS STEPS */}
        <View style={s.card}>
          <Text style={s.cardTitle}>LIVE STATUS</Text>
          {STEPS.map((st, i) => (
            <View key={i} style={s.step}>
              <View style={[s.dot,
                st.done ? s.dotDone :
                i === STEPS.findIndex(x => !x.done) ? s.dotActive :
                s.dotPending
              ]} />
              <Text style={[s.stepLabel, st.done && s.stepLabelDone]}>
                {st.label}
              </Text>
            </View>
          ))}
        </View>

        {/* ACTION BUTTONS */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.callBtn} onPress={callTech}>
            <Text style={s.callTxt}>📞 Call Tech</Text>
          </TouchableOpacity>
          {techLat && (
            <TouchableOpacity style={s.mapsBtn} onPress={openMaps}>
              <Text style={s.mapsTxt}>🗺️ View Map</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* REVIEW BUTTON — only shows when done */}
        {jobDone && (
          <TouchableOpacity
            style={s.reviewBtn}
            onPress={() => router.push('/screens/ReviewScreen')}
          >
            <Text style={s.reviewTxt}>⭐ Rate Your Experience</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f5f5' },

  // Header
  header:       { backgroundColor: '#FF6B00', padding: 20, paddingTop: Platform.OS === 'ios' ? 55 : 45, flexDirection: 'row', alignItems: 'center' },
  back:         { fontSize: 24, color: '#fff', fontWeight: '700' },
  title:        { fontSize: 18, fontWeight: '800', color: '#fff' },
  sub:          { fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  pill:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pillTxt:      { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Map area
  mapArea:      { height: 200, alignItems: 'center', justifyContent: 'center', gap: 10 },
  mapIcon:      { fontSize: 60 },
  mapTitle:     { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center', paddingHorizontal: 20 },
  mapBtn:       { backgroundColor: '#FF6B00', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginTop: 5 },
  mapBtnTxt:    { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Content
  content:      { padding: 15 },
  distBanner:   { backgroundColor: '#1A3A6B', borderRadius: 16, padding: 15, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  distLabel:    { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
  distVal:      { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 2 },
  etaPill:      { backgroundColor: '#FF6B00', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  etaTxt:       { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Location cards
  locRow:       { flexDirection: 'row', gap: 10, marginBottom: 12 },
  locCard:      { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 2 },
  locIcon:      { fontSize: 28 },
  locLabel:     { fontSize: 10, fontWeight: '800', color: '#888', marginTop: 4, letterSpacing: 1 },
  locName:      { fontSize: 11, fontWeight: '800', color: '#1A3A6B', marginTop: 3, textAlign: 'center' },

  // Card
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 12, elevation: 2 },
  cardTitle:    { fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 1, marginBottom: 12 },

  // Tech info
  techRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  techAvatar:   { width: 50, height: 50, backgroundColor: '#1A3A6B', borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  techName:     { fontSize: 15, fontWeight: '800', color: '#1A3A6B' },
  techSub:      { fontSize: 12, color: '#888', marginTop: 2 },
  techPhone:    { fontSize: 12, color: '#FF6B00', fontWeight: '700', marginTop: 2 },
  ratingBadge:  { backgroundColor: '#fff5ee', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  ratingTxt:    { color: '#FF6B00', fontSize: 12, fontWeight: '800' },

  // Order details
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoLabel:    { color: '#888', fontWeight: '600', fontSize: 13 },
  infoVal:      { color: '#1A3A6B', fontWeight: '800', fontSize: 13, flex: 1, textAlign: 'right' },

  // Status steps
  step:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  dot:          { width: 14, height: 14, borderRadius: 7 },
  dotDone:      { backgroundColor: '#FF6B00' },
  dotActive:    { backgroundColor: '#1A3A6B' },
  dotPending:   { backgroundColor: '#ddd' },
  stepLabel:    { fontSize: 13, fontWeight: '600', color: '#888' },
  stepLabelDone:{ color: '#1A3A6B', fontWeight: '800' },

  // Buttons
  actionRow:    { flexDirection: 'row', gap: 10, marginBottom: 10 },
  callBtn:      { flex: 1, backgroundColor: '#1A3A6B', padding: 15, borderRadius: 14, alignItems: 'center' },
  callTxt:      { color: '#fff', fontSize: 15, fontWeight: '800' },
  mapsBtn:      { flex: 1, backgroundColor: '#FF6B00', padding: 15, borderRadius: 14, alignItems: 'center' },
  mapsTxt:      { color: '#fff', fontSize: 15, fontWeight: '800' },
  reviewBtn:    { backgroundColor: '#FF6B00', padding: 16, borderRadius: 14, alignItems: 'center' },
  reviewTxt:    { color: '#fff', fontSize: 16, fontWeight: '800' },
})