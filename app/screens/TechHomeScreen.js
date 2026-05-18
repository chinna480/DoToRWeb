import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { onValue, ref, remove, set, update } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';
import {
  Alert, Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../firebase/config';
import { calcDistance } from '../utils/distance';
import {
  notifyCustomerJobDone,
  notifyCustomerTechAccepted,
  notifyCustomerTechArrived,
  notifyCustomerTechNearby,
  notifyTechJobDone,
  notifyTechNewJob,
} from '../utils/notifications';

// ✅ Safe import — won't crash if react-native-maps is not installed
let MapView, Marker, Polyline
try {
  const Maps = require('react-native-maps')
  MapView  = Maps.default
  Marker   = Maps.Marker
  Polyline = Maps.Polyline
} catch (e) {
  MapView = null
}

export default function TechHomeScreen() {
  const router = useRouter()
  const [techName, setTechName]          = useState('Technician')
  const [techLoc, setTechLoc]            = useState('')
  const [isOnline, setIsOnline]          = useState(true)
  const [pendingJobs, setPending]        = useState([])
  const [ongoingJob, setOngoing]         = useState(null)
  const [completedJobs, setCompleted]    = useState([])
  const [totalJobs, setTotal]            = useState(0)
  const [custLat, setCustLat]            = useState(null)
  const [custLng, setCustLng]            = useState(null)
  const [myLat, setMyLat]               = useState(17.3850)
  const [myLng, setMyLng]               = useState(78.4867)
  const [distance, setDistance]          = useState('--')
  const [eta, setEta]                    = useState('--')
  const [currentCustPhone, setCustPhone] = useState('')
  const watchRef       = useRef(null)
  const mapRef         = useRef(null)
  const techPushToken  = useRef(null)
  const sentNearby     = useRef(false)
  const sentArrived    = useRef(false)
  const prevPendingIds = useRef(new Set())

  useEffect(() => {
    loadTech()
    const unsub = listenOrders()
    return () => { unsub(); if (watchRef.current) watchRef.current.remove() }
  }, [])

  useEffect(() => {
    if (ongoingJob) {
      startLocationSharing()
      sentNearby.current  = false
      sentArrived.current = false
    } else {
      if (watchRef.current) { watchRef.current.remove(); watchRef.current = null }
    }
  }, [ongoingJob])

  useEffect(() => {
    if (!custLat || !myLat || !ongoingJob) return
    const d = calcDistance(myLat, myLng, custLat, custLng)
    const etaMins = Math.round(d / 0.5)
    setDistance(d + ' km')
    setEta('~' + etaMins + ' mins')
    const custToken = ongoingJob?.customerPushToken
    if (etaMins <= 5 && !sentNearby.current) {
      sentNearby.current = true
      notifyCustomerTechNearby(custToken, etaMins)
    }
    if (d <= 0.2 && !sentArrived.current) {
      sentArrived.current = true
      notifyCustomerTechArrived(custToken)
    }
  }, [custLat, myLat, ongoingJob])

  const loadTech = async () => {
    const n = await AsyncStorage.getItem('techName')
    const l = await AsyncStorage.getItem('techLocation')
    const t = await AsyncStorage.getItem('pushToken')
    setTechName(n || 'Technician')
    setTechLoc(l || 'Your Location')
    if (t) techPushToken.current = t
  }

  const logout = () => {
    Alert.alert('Logout?', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          await AsyncStorage.clear()
          router.replace('/screens/RoleScreen')
        }
      }
    ])
  }

  const startLocationSharing = async () => {
    if (watchRef.current) return
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 4000 },
      pos => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude
        setMyLat(lat); setMyLng(lng)
        set(ref(db, 'techLocation'), { lat, lng })
      }
    )
  }

  const listenOrders = () => {
    const unsub = onValue(ref(db, 'orders'), snapshot => {
      if (!snapshot.exists()) {
        setPending([]); setOngoing(null); setCompleted([]); setTotal(0)
        prevPendingIds.current = new Set()
        return
      }
      const pending = [], completed = []
      let ongoing = null, count = 0

      snapshot.forEach(child => {
        const order = { id: child.key, ...child.val() }
        if (order.status === 'pending')   pending.push(order)
        if (order.status === 'accepted')  ongoing = order
        if (order.status === 'completed') { completed.push(order); count++ }
      })

      pending.forEach(order => {
        if (!prevPendingIds.current.has(order.id)) {
          notifyTechNewJob(techPushToken.current, order.customerName, order.brand, order.repair)
        }
      })
      prevPendingIds.current = new Set(pending.map(o => o.id))

      setPending(pending)
      setOngoing(ongoing)
      setCompleted(completed)
      setTotal(count)
      if (ongoing) setCustPhone(ongoing.customerPhone || '')
    })

    onValue(ref(db, 'custLocation'), snap => {
      if (!snap.exists()) return
      setCustLat(snap.val().lat)
      setCustLng(snap.val().lng)
    })

    return unsub
  }

  const acceptJob = async (orderId, order) => {
    const name  = await AsyncStorage.getItem('techName')     || 'Technician'
    const loc   = await AsyncStorage.getItem('techLocation') || ''
    const phone = await AsyncStorage.getItem('techPhone')    || ''
    set(ref(db, 'techInfo'), { name, location: loc, phone })
    update(ref(db, 'orders/' + orderId), { status: 'accepted' })
      .then(async () => {
        Alert.alert('✅ Job Accepted!', 'Customer can now track you!')
        if (order.customerPushToken) {
          await notifyCustomerTechAccepted(order.customerPushToken, name)
        }
      })
      .catch(() => Alert.alert('Error', 'Failed to accept. Try again!'))
  }

  const rejectJob = (orderId) => {
    Alert.alert('Reject Job?', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Reject', style: 'destructive', onPress: () => {
          update(ref(db, 'orders/' + orderId), { status: 'rejected' })
        }
      }
    ])
  }

  const completeJob = (orderId) => {
    Alert.alert('Mark Complete?', 'Job is done?', [
      { text: 'Cancel' },
      {
        text: 'Complete ✅', onPress: async () => {
          update(ref(db, 'orders/' + orderId), { status: 'completed' })
          remove(ref(db, 'techLocation'))
          remove(ref(db, 'techInfo'))
          remove(ref(db, 'custLocation'))
          if (watchRef.current) { watchRef.current.remove(); watchRef.current = null }
          if (ongoingJob?.customerPushToken) {
            await notifyCustomerJobDone(ongoingJob.customerPushToken)
          }
          await notifyTechJobDone()
          Alert.alert('🎉 Job Complete!', 'Great work! Customer will be asked to review.')
        }
      }
    ])
  }

  const navigate = () => {
    if (custLat && custLng) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${custLat},${custLng}`)
    } else {
      Alert.alert('Not Available', 'Customer location not available yet!')
    }
  }

  const callCustomer = () => {
    if (currentCustPhone) Linking.openURL('tel:+91' + currentCustPhone)
    else Alert.alert('Not Available', 'Customer phone not available!')
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>

      {/* HEADER */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Welcome Back! 👋</Text>
          <Text style={s.name}>{techName}</Text>
          <Text style={s.loc}>📍 {techLoc}</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.avatar}
            onPress={() => router.push('/screens/TechProfileScreen')}
          >
            <Text style={{ fontSize: 24 }}>🔧</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.onlinePill, !isOnline && s.offlinePill]}
            onPress={() => setIsOnline(p => !p)}
          >
            <Text style={[s.onlineTxt, !isOnline && s.offlineTxt]}>
              {isOnline ? '🟢 Online' : '🔴 Offline'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800' }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* STATS */}
      <View style={s.earningsRow}>
        <View style={s.earnCard}>
          <Text style={s.earnLabel}>Today's Jobs</Text>
          <Text style={s.earnAmt}>{totalJobs}</Text>
        </View>
        <View style={s.earnCard}>
          <Text style={s.earnLabel}>Pending</Text>
          <Text style={s.earnAmt}>{pendingJobs.length}</Text>
        </View>
        <View style={s.earnCard}>
          <Text style={s.earnLabel}>Status</Text>
          <Text style={[s.earnAmt, { fontSize: 13 }]}>{isOnline ? '🟢 Active' : '🔴 Off'}</Text>
        </View>
      </View>

      {/* PENDING JOBS */}
      <Text style={s.sectionTitle}>📋 Pending Jobs</Text>
      {pendingJobs.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyTxt}>No new jobs right now</Text>
        </View>
      ) : (
        pendingJobs.map(order => (
          <View key={order.id} style={s.jobCard}>
            <View style={s.newBadge}><Text style={s.newBadgeTxt}>NEW</Text></View>
            <Text style={s.jobCust}>👤 {order.customerName}</Text>
            <Text style={s.jobType}>📱 {order.brand} — {order.repair}</Text>
            <Text style={s.jobLoc}>📍 {order.location}</Text>
            <Text style={s.jobTime}>🕐 {order.time}</Text>
            <View style={s.jobActions}>
              <TouchableOpacity style={s.rejectBtn} onPress={() => rejectJob(order.id)}>
                <Text style={s.rejectTxt}>✕ Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.acceptBtn} onPress={() => acceptJob(order.id, order)}>
                <Text style={s.acceptTxt}>✓ Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* ONGOING JOB */}
      <Text style={s.sectionTitle}>🔧 Ongoing Job</Text>
      {!ongoingJob ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyTxt}>No ongoing job right now</Text>
        </View>
      ) : (
        <View style={s.ongoingCard}>
          <Text style={s.jobCust}>👤 {ongoingJob.customerName}</Text>
          <Text style={s.jobType}>📱 {ongoingJob.brand} — {ongoingJob.repair}</Text>
          <Text style={s.jobLoc}>📍 {ongoingJob.location}</Text>
          <Text style={s.inProgressTxt}>⚡ In Progress...</Text>

          <View style={s.distBanner}>
            <View>
              <Text style={s.distLabel}>Distance to Customer</Text>
              <Text style={s.distVal}>{distance}</Text>
            </View>
            <View style={s.etaPill}><Text style={s.etaTxt}>{eta}</Text></View>
          </View>

          <View style={s.locRow}>
            <View style={s.locCard}>
              <Text style={s.locIcon}>🛵</Text>
              <Text style={s.locLabel}>YOUR LOCATION</Text>
              <Text style={s.locName}>On the way</Text>
            </View>
            <View style={s.locCard}>
              <Text style={s.locIcon}>🏠</Text>
              <Text style={s.locLabel}>CUSTOMER</Text>
              <Text style={s.locName}>{custLat ? 'Live' : 'Waiting...'}</Text>
            </View>
          </View>

          {/* ✅ Safe MapView — only renders if react-native-maps is installed */}
          {MapView && (custLat || myLat) && (
            <MapView
              ref={mapRef}
              style={s.map}
              region={{
                latitude:      (myLat + (custLat || myLat)) / 2,
                longitude:     (myLng + (custLng || myLng)) / 2,
                latitudeDelta:  0.05,
                longitudeDelta: 0.05,
              }}
            >
              <Marker coordinate={{ latitude: myLat, longitude: myLng }} title="🛵 You" pinColor="#1A3A6B" />
              {custLat && (
                <>
                  <Marker coordinate={{ latitude: custLat, longitude: custLng }} title="🏠 Customer" />
                  <Polyline
                    coordinates={[{ latitude: myLat, longitude: myLng }, { latitude: custLat, longitude: custLng }]}
                    strokeColor="#FF6B00" strokeWidth={3} lineDashPattern={[8, 8]}
                  />
                </>
              )}
            </MapView>
          )}

          <View style={s.btnRow}>
            <TouchableOpacity style={s.navBtn} onPress={navigate}>
              <Text style={s.navTxt}>🗺️ Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.callBtn} onPress={callCustomer}>
              <Text style={s.callTxt}>📞 Call</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.completeBtn} onPress={() => completeJob(ongoingJob.id)}>
            <Text style={s.completeTxt}>✅ Mark Complete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* COMPLETED JOBS */}
      <Text style={s.sectionTitle}>✅ Completed Jobs</Text>
      {completedJobs.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyTxt}>No completed jobs yet</Text>
        </View>
      ) : (
        completedJobs.map((order, i) => (
          <View key={i} style={s.completedCard}>
            <View>
              <Text style={s.compCust}>👤 {order.customerName}</Text>
              <Text style={s.compType}>📱 {order.brand} — {order.repair}</Text>
            </View>
            <View style={s.compRight}>
              <Text style={s.compPrice}>✅ Done</Text>
              <Text style={s.compTime}>{order.time || ''}</Text>
            </View>
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#f5f5f5' },
  header:        { backgroundColor: '#1A3A6B', padding: 20, paddingTop: 55, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting:      { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  name:          { fontSize: 20, color: '#fff', fontWeight: '800' },
  loc:           { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  headerRight:   { alignItems: 'center', gap: 8 },
  avatar:        { width: 50, height: 50, backgroundColor: '#fff', borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  onlinePill:    { backgroundColor: '#e8f5e9', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  offlinePill:   { backgroundColor: '#ffebee' },
  onlineTxt:     { fontSize: 12, fontWeight: '800', color: '#2e7d32' },
  offlineTxt:    { color: '#c62828' },
  earningsRow:   { flexDirection: 'row', gap: 10, margin: 15 },
  earnCard:      { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 3 },
  earnLabel:     { fontSize: 11, color: '#888', fontWeight: '700' },
  earnAmt:       { fontSize: 18, fontWeight: '800', color: '#1A3A6B', marginTop: 4 },
  sectionTitle:  { fontSize: 16, fontWeight: '800', color: '#1A3A6B', marginHorizontal: 15, marginTop: 20, marginBottom: 12 },
  emptyCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginHorizontal: 15, alignItems: 'center', elevation: 2, marginBottom: 5 },
  emptyTxt:      { color: '#888', fontWeight: '600', fontSize: 13 },
  jobCard:       { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginHorizontal: 15, marginBottom: 12, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#FF6B00' },
  newBadge:      { position: 'absolute', top: 12, right: 12, backgroundColor: '#FF6B00', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  newBadgeTxt:   { color: '#fff', fontSize: 10, fontWeight: '800' },
  jobCust:       { fontSize: 15, fontWeight: '800', color: '#1A3A6B' },
  jobType:       { fontSize: 13, fontWeight: '700', color: '#FF6B00', marginTop: 4 },
  jobLoc:        { fontSize: 12, color: '#888', fontWeight: '600', marginTop: 3 },
  jobTime:       { fontSize: 12, color: '#888', fontWeight: '600', marginTop: 3 },
  jobActions:    { flexDirection: 'row', gap: 10, marginTop: 15 },
  rejectBtn:     { flex: 1, backgroundColor: '#ffebee', padding: 12, borderRadius: 12, alignItems: 'center' },
  rejectTxt:     { color: '#c62828', fontSize: 14, fontWeight: '800' },
  acceptBtn:     { flex: 1, backgroundColor: '#1A3A6B', padding: 12, borderRadius: 12, alignItems: 'center' },
  acceptTxt:     { color: '#fff', fontSize: 14, fontWeight: '800' },
  ongoingCard:   { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginHorizontal: 15, marginBottom: 12, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#FF6B00' },
  inProgressTxt: { fontSize: 12, fontWeight: '800', color: '#FF6B00', marginTop: 8, marginBottom: 5 },
  distBanner:    { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 12, marginVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  distLabel:     { fontSize: 11, color: '#888', fontWeight: '700' },
  distVal:       { fontSize: 20, fontWeight: '800', color: '#1A3A6B', marginTop: 2 },
  etaPill:       { backgroundColor: '#FF6B00', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  etaTxt:        { color: '#fff', fontSize: 11, fontWeight: '800' },
  locRow:        { flexDirection: 'row', gap: 8, marginBottom: 12 },
  locCard:       { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 12, padding: 10, alignItems: 'center' },
  locIcon:       { fontSize: 22 },
  locLabel:      { fontSize: 10, fontWeight: '800', color: '#888', marginTop: 3, letterSpacing: 1 },
  locName:       { fontSize: 11, fontWeight: '800', color: '#1A3A6B', marginTop: 2 },
  map:           { width: '100%', height: 200, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  btnRow:        { flexDirection: 'row', gap: 8, marginBottom: 8 },
  navBtn:        { flex: 1, backgroundColor: '#FF6B00', padding: 12, borderRadius: 12, alignItems: 'center' },
  navTxt:        { color: '#fff', fontSize: 13, fontWeight: '800' },
  callBtn:       { flex: 1, backgroundColor: '#2e7d32', padding: 12, borderRadius: 12, alignItems: 'center' },
  callTxt:       { color: '#fff', fontSize: 13, fontWeight: '800' },
  completeBtn:   { backgroundColor: '#1A3A6B', padding: 13, borderRadius: 12, alignItems: 'center' },
  completeTxt:   { color: '#fff', fontSize: 14, fontWeight: '800' },
  completedCard: { backgroundColor: '#fff', borderRadius: 14, padding: 15, marginHorizontal: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  compCust:      { fontSize: 13, fontWeight: '800', color: '#1A3A6B' },
  compType:      { fontSize: 12, color: '#888', fontWeight: '600', marginTop: 3 },
  compRight:     { alignItems: 'flex-end' },
  compPrice:     { fontSize: 14, fontWeight: '800', color: '#FF6B00' },
  compTime:      { fontSize: 11, color: '#888', marginTop: 3 },
})