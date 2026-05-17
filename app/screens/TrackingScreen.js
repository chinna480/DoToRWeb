import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { onValue, ref, set } from 'firebase/database'
import { useEffect, useRef, useState } from 'react'
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { db } from '../firebase/config'
import { calcDistance } from '../utils/distance'

export default function TrackingScreen() {
  const router = useRouter()
  const [custLat, setCustLat]   = useState(17.3850)
  const [custLng, setCustLng]   = useState(78.4867)
  const [techLat, setTechLat]   = useState(null)
  const [techLng, setTechLng]   = useState(null)
  const [distance, setDistance] = useState('--')
  const [eta, setEta]           = useState('--')
  const [techName, setTechName] = useState('Connecting...')
  const [techPhone, setTechPhone] = useState('')
  const [status, setStatus]     = useState('Waiting for technician...')
  const [brand, setBrand]       = useState('')
  const [repair, setRepair]     = useState('')
  const [location, setLocation] = useState('')
  const [jobDone, setJobDone]   = useState(false)
  const watchRef = useRef(null)

  useEffect(() => {
    loadData()
    startSharing()
    const unsubTech  = listenTechLocation()
    const unsubInfo  = listenTechInfo()
    const unsubOrder = listenOrders()
    return () => {
      if (watchRef.current) watchRef.current.remove()
      unsubTech(); unsubInfo(); unsubOrder()
    }
  }, [])

  const loadData = async () => {
    setBrand(await AsyncStorage.getItem('lastBrand')    || '')
    setRepair(await AsyncStorage.getItem('lastRepair')  || '')
    setLocation(await AsyncStorage.getItem('custLocation') || '')
  }

  const startSharing = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000 },
      pos => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude
        setCustLat(lat); setCustLng(lng)
        set(ref(db, 'custLocation'), { lat, lng })
      }
    )
  }

  const listenTechLocation = () => {
    const unsub = onValue(ref(db, 'techLocation'), snap => {
      if (!snap.exists()) return
      const { lat, lng } = snap.val()
      setTechLat(lat); setTechLng(lng)
      setStatus('🛵 Technician is on the way!')
      const d = calcDistance(custLat, custLng, lat, lng)
      setDistance(d + ' km')
      setEta('~' + Math.round(d / 0.5) + ' mins')
    })
    return unsub
  }

  const listenTechInfo = () => {
    const unsub = onValue(ref(db, 'techInfo'), snap => {
      if (!snap.exists()) return
      setTechName(snap.val().name  || 'Technician')
      setTechPhone(snap.val().phone || '')
    })
    return unsub
  }

  const listenOrders = () => {
    const unsub = onValue(ref(db, 'orders'), snap => {
      if (!snap.exists()) return
      snap.forEach(child => {
        if (child.val().status === 'completed') {
          setStatus('✅ Repair Completed!'); setJobDone(true)
        }
      })
    })
    return unsub
  }

  const callTech = () => {
    if (techPhone) Linking.openURL('tel:+91' + techPhone)
    else Alert.alert('Not Available', 'Technician phone not available yet!')
  }

  const mid = {
    latitude:       (custLat + (techLat || custLat)) / 2,
    longitude:      (custLng + (techLng || custLng)) / 2,
    latitudeDelta:  0.05,
    longitudeDelta: 0.05,
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* HEADER */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>🛵 Live Tracking</Text>
          <Text style={s.sub}>{status}</Text>
        </View>
        <View style={[s.pill, { backgroundColor: jobDone ? '#2e7d32' : '#FF6B00' }]}>
          <Text style={s.pillTxt}>{jobDone ? '✅ Done' : '🟢 Live'}</Text>
        </View>
      </View>

      {/* MAP */}
      <MapView style={s.map} region={mid}>
        <Marker coordinate={{ latitude: custLat, longitude: custLng }} title="🏠 Your Location" />
        {techLat && <Marker coordinate={{ latitude: techLat, longitude: techLng }} title="🛵 Technician" pinColor="#FF6B00" />}
        {techLat && (
          <Polyline
            coordinates={[{ latitude: custLat, longitude: custLng }, { latitude: techLat, longitude: techLng }]}
            strokeColor="#FF6B00" strokeWidth={3} lineDashPattern={[8, 8]}
          />
        )}
      </MapView>

      <View style={s.content}>
        {/* DISTANCE */}
        <View style={s.distBanner}>
          <View>
            <Text style={s.distLabel}>Distance</Text>
            <Text style={s.distVal}>{distance}</Text>
          </View>
          <View style={s.etaPill}><Text style={s.etaTxt}>ETA: {eta}</Text></View>
        </View>

        {/* LOC CARDS */}
        <View style={s.locRow}>
          <View style={s.locCard}>
            <Text style={s.locIcon}>🏠</Text>
            <Text style={s.locLabel}>YOUR LOCATION</Text>
            <Text style={s.locName}>{location || 'Your Location'}</Text>
          </View>
          <View style={s.locCard}>
            <Text style={s.locIcon}>🛵</Text>
            <Text style={s.locLabel}>TECHNICIAN</Text>
            <Text style={s.locName}>{techLat ? 'On the way' : 'Waiting...'}</Text>
          </View>
        </View>

        {/* TECH INFO */}
        <View style={s.card}>
          <Text style={s.cardTitle}>YOUR TECHNICIAN</Text>
          <View style={s.techRow}>
            <View style={s.techAvatar}><Text style={{ fontSize: 24 }}>👨‍🔧</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.techName}>{techName}</Text>
              <Text style={s.techSub}>⭐ Verified Expert</Text>
            </View>
            <View style={s.ratingBadge}><Text style={s.ratingTxt}>⭐ 4.8</Text></View>
          </View>
        </View>

        {/* ORDER */}
        <View style={s.card}>
          <Text style={s.cardTitle}>ORDER DETAILS</Text>
          {[['Device', brand], ['Repair', repair], ['Location', location]].map(([l, v]) => (
            <View key={l} style={s.infoRow}>
              <Text style={s.infoLabel}>{l}</Text>
              <Text style={s.infoVal}>{v || '-'}</Text>
            </View>
          ))}
        </View>

        {/* STATUS */}
        <View style={s.card}>
          <Text style={s.cardTitle}>LIVE STATUS</Text>
          {[
            ['done',                             '✅ Order Confirmed'],
            [techLat ? 'done' : 'active',        '🚗 Technician On The Way'],
            [jobDone ? 'done' : 'pending',       '🔧 Repair In Progress'],
            [jobDone ? 'done' : 'pending',       '✅ Repair Done!'],
          ].map(([dot, label], i) => (
            <View key={i} style={s.step}>
              <View style={[s.dot, dot === 'done' ? s.dotDone : dot === 'active' ? s.dotActive : s.dotPending]} />
              <Text style={s.stepLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={s.callBtn} onPress={callTech}>
          <Text style={s.callTxt}>📞 Call Technician</Text>
        </TouchableOpacity>

        {jobDone && (
          <TouchableOpacity style={s.reviewBtn} onPress={() => router.push('/screens/ReviewScreen')}>
            <Text style={s.reviewTxt}>⭐ Rate Your Experience</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f5' },
  header:      { backgroundColor: '#FF6B00', padding: 20, paddingTop: 55, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:       { fontSize: 20, fontWeight: '800', color: '#fff' },
  sub:         { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  pill:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pillTxt:     { color: '#fff', fontSize: 11, fontWeight: '800' },
  map:         { width: '100%', height: 280 },
  content:     { padding: 15 },
  distBanner:  { backgroundColor: '#1A3A6B', borderRadius: 16, padding: 15, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  distLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
  distVal:     { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 2 },
  etaPill:     { backgroundColor: '#FF6B00', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  etaTxt:      { color: '#fff', fontSize: 12, fontWeight: '800' },
  locRow:      { flexDirection: 'row', gap: 10, marginBottom: 12 },
  locCard:     { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 3 },
  locIcon:     { fontSize: 28 },
  locLabel:    { fontSize: 10, fontWeight: '800', color: '#888', marginTop: 4, letterSpacing: 1 },
  locName:     { fontSize: 12, fontWeight: '800', color: '#1A3A6B', marginTop: 3, textAlign: 'center' },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 12, elevation: 3 },
  cardTitle:   { fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 1, marginBottom: 12 },
  techRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  techAvatar:  { width: 50, height: 50, backgroundColor: '#1A3A6B', borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  techName:    { fontSize: 15, fontWeight: '800', color: '#1A3A6B' },
  techSub:     { fontSize: 12, color: '#888', marginTop: 2 },
  ratingBadge: { backgroundColor: '#fff5ee', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  ratingTxt:   { color: '#FF6B00', fontSize: 12, fontWeight: '800' },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoLabel:   { color: '#888', fontWeight: '600', fontSize: 13 },
  infoVal:     { color: '#1A3A6B', fontWeight: '800', fontSize: 13 },
  step:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  dot:         { width: 14, height: 14, borderRadius: 7 },
  dotDone:     { backgroundColor: '#FF6B00' },
  dotActive:   { backgroundColor: '#1A3A6B' },
  dotPending:  { backgroundColor: '#ddd' },
  stepLabel:   { fontSize: 13, fontWeight: '700', color: '#1A3A6B' },
  callBtn:     { backgroundColor: '#1A3A6B', padding: 15, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  callTxt:     { color: '#fff', fontSize: 16, fontWeight: '800' },
  reviewBtn:   { backgroundColor: '#FF6B00', padding: 15, borderRadius: 14, alignItems: 'center' },
  reviewTxt:   { color: '#fff', fontSize: 16, fontWeight: '800' },
})