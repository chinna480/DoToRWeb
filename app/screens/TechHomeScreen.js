import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { onValue, ref, remove, set, update } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';
import {
  Alert, Image, Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../firebase/config';
import { calcDistance } from '../utils/distance';

// ── GPS-based matching configuration ─────────────────────────────────────
// RADIUS_KM:          Maximum distance (km) to show pending jobs to a tech.
// AUTO_ASSIGN_RADIUS: Distance (km) within which a job is eligible for auto-assign.
// If GPS is unavailable, falls back to text-based location/pincode matching.
const RADIUS_KM = 10          // Show jobs within 10km
const AUTO_ASSIGN_RADIUS = 5  // Auto-assign eligible within 5km
// ─────────────────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications'

import {
  notifyCustomerJobDone,
  notifyCustomerTechAccepted,
  notifyCustomerTechArrived,
  notifyCustomerTechNearby,
  notifyTechJobDone,
  notifyTechNewJob,
  playJobCompleteSound,
  playNewJobSound,
} from '../utils/notifications';

// ✅ Safe import — won't crash if react-native-maps is not installed
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

export default function TechHomeScreen() {
  const router = useRouter()
  const [activeTab, setActiveTab]          = useState('home')
  const [techName, setTechName]            = useState('Technician')
  const [techLoc, setTechLoc]              = useState('')
  const [isOnline, setIsOnline]            = useState(true)
  const [pendingJobs, setPending]          = useState([])
  const [ongoingJob, setOngoing]           = useState(null)
  const [completedJobs, setCompleted]      = useState([])
  const [totalJobs, setTotal]              = useState(0)
  const [dailyCompleted, setDailyCompleted] = useState(0)
  const [custLat, setCustLat]            = useState(null)
  const [custLng, setCustLng]            = useState(null)
  const [myLat, setMyLat]               = useState(17.3850)
  const [myLng, setMyLng]               = useState(78.4867)
  const [distance, setDistance]          = useState('--')
  const [eta, setEta]                    = useState('--')
  const [currentCustPhone, setCustPhone] = useState('')
  const [fullscreenImgIndex, setFullscreenImgIndex] = useState(-1)
  const [fullscreenImages, setFullscreenImages] = useState([])
  const [fullscreenOrderId, setFullscreenOrderId] = useState(null)

  const watchRef          = useRef(null)
  const mapRef            = useRef(null)
  const techPushToken     = useRef(null)
  const techLocRef        = useRef('')
  const techPincodeRef    = useRef('')
  const techPhoneRef      = useRef('')
  const myLatRef          = useRef(17.3850) // ref to avoid stale closures in onValue
  const myLngRef          = useRef(78.4867) // ref to avoid stale closures in onValue
  const sentNearby        = useRef(false)
  const sentArrived       = useRef(false)
  const prevPendingIds    = useRef(new Set())
  const areaAssignments   = useRef({})

  useEffect(() => {
    loadTech()
    const unsub = listenOrders()
    return () => {
      unsub()
      if (watchRef.current) watchRef.current.remove()
      // Remove tech from online tracking on unmount
      const phone = techPhoneRef.current
      if (phone) remove(ref(db, 'techsOnline/' + phone))
    }
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
    const d = parseFloat(calcDistance(myLat, myLng, custLat, custLng))
    const SPEED = 0.3 // km/min (~18 km/h — realistic city speed)
    const etaMins = Math.round(d / SPEED)
    setDistance(d + ' km')
    setEta('~' + Math.max(1, etaMins) + ' mins')
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
    const pi = await AsyncStorage.getItem('techPincode')
    const t = await AsyncStorage.getItem('pushToken')
    const p = await AsyncStorage.getItem('techPhone')
    setTechName(n || 'Technician')
    setTechLoc(l || 'Your Location')
    techLocRef.current = (l || '').toLowerCase().trim()
    techPincodeRef.current = (pi || '').toLowerCase().trim()
    techPhoneRef.current = p || ''
    if (t) techPushToken.current = t

    // ── GPS-based matching: fetch current location for distance calculations ──
    // This one-time position is used to filter pending jobs by actual geo-distance
    // instead of relying purely on text-based area/pincode matching.
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({})
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setMyLat(lat)
        setMyLng(lng)
        myLatRef.current = lat
        myLngRef.current = lng
        // Save to techsOnline for GPS-based proximity matching
        if (p) {
          set(ref(db, 'techsOnline/' + p), {
            lat,
            lng,
            name: n || 'Technician',
            lastSeen: Date.now()
          })
        }
      }
    } catch (e) {
      console.warn('GPS not available, falling back to text-based matching')
    }
  }

  const logout = () => {
    Alert.alert('Logout?', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          const phone = techPhoneRef.current
          if (phone) remove(ref(db, 'techsOnline/' + phone))
          await AsyncStorage.clear()
          router.replace('/screens/RoleScreen')
        }
      }
    ])
  }

  const startLocationSharing = async () => {
    if (watchRef.current) return
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return      watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 4000 },
      pos => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude
        setMyLat(lat); setMyLng(lng)
        myLatRef.current = lat
        myLngRef.current = lng
        set(ref(db, 'techLocation'), { lat, lng })
        // Also keep techsOnline updated for GPS matching
        const phone = techPhoneRef.current
        if (phone) {
          set(ref(db, 'techsOnline/' + phone), {
            lat,
            lng,
            name: techName,
            lastSeen: Date.now()
          })
        }
      }
    )
  }

  // ── GPS-based Proximity Matching ────────────────────────────────────────
  //
  // FILTERING LOGIC (two-tier approach):
  //
  // 1. GPS-BASED (preferred):
  //    - When a tech's GPS is available, calculate Haversine distance from
  //      the tech's current location to each order's saved GPS coords.
  //    - Only orders within RADIUS_KM (10km) are shown, sorted by distance.
  //
  // 2. TEXT-BASED (fallback):
  //    - If GPS is unavailable, fall back to matching by location text and
  //      pincode (substring matching handles formatting differences).
  // ─────────────────────────────────────────────────────────────────────────
  const listenOrders = () => {
    // Listen for area-to-technician assignments
    const unsubArea = onValue(ref(db, 'areaAssignments'), snap => {
      if (snap.exists()) {
        areaAssignments.current = snap.val()
      } else {
        areaAssignments.current = {}
      }
    })

    const unsub = onValue(ref(db, 'orders'), snapshot => {
      if (!snapshot.exists()) {
        setPending([]); setOngoing(null); setCompleted([]); setTotal(0); setDailyCompleted(0)
        prevPendingIds.current = new Set()
        return
      }
      const allPending = [], completed = []
      let ongoing = null, count = 0, dailyCount = 0

      snapshot.forEach(child => {
        const val = child.val()
        const order = { id: child.key, ...val }
        // Normalize images: Firebase stores arrays as objects {0:"url",1:"url"}
        // Also handle edge cases: string, null, or malformed objects
        if (order.images) {
          if (typeof order.images === 'string') {
            order.images = [order.images]
          } else if (!Array.isArray(order.images)) {
            order.images = Object.values(order.images).filter(v => typeof v === 'string')
          }
        } else {
          order.images = []
        }

        if (order.status === 'pending')   allPending.push(order)
        if (order.status === 'accepted') {
          // Only mark as ongoing if THIS tech accepted the job
          if (order.techPhone === techPhoneRef.current) ongoing = order
        }
        if (order.status === 'completed') {
          completed.push(order); count++
          // ✅ FIX: Only count completed jobs from today for the "Today's Jobs" stat
          if (order.completedTime) {
            const completedDate = new Date(order.completedTime)
            const today = new Date()
            if (completedDate.getFullYear() === today.getFullYear() &&
                completedDate.getMonth() === today.getMonth() &&
                completedDate.getDate() === today.getDate()) {
              dailyCount++
            }
          }
        }
      })

      const myPhone = techPhoneRef.current

      // ── STEP 1: Filter pending jobs by GPS distance (preferred) ───────────
      // Use refs to avoid stale closures — refs always hold the latest GPS values
      let pending = allPending
      const techLat = myLatRef.current
      const techLng = myLngRef.current

      if (techLat !== 17.3850 || techLng !== 78.4867) {
        // GPS is available — filter by actual geo-distance
        pending = pending.filter(o => {
          if (o.custLat && o.custLng) {
            const d = parseFloat(calcDistance(techLat, techLng, o.custLat, o.custLng))
            return !isNaN(d) && d <= RADIUS_KM
          }
          // Fallback: if order has no GPS coords, use text matching
          return textMatchOrder(o)
        })
        // Sort by distance (closest first) — like Rapido shows nearest rides first
        pending.sort((a, b) => {
          const dA = a.custLat ? parseFloat(calcDistance(techLat, techLng, a.custLat, a.custLng)) : Infinity
          const dB = b.custLat ? parseFloat(calcDistance(techLat, techLng, b.custLat, b.custLng)) : Infinity
          return dA - dB
        })
      } else {
        // ── STEP 2: Fallback — text-based location/pincode matching ─────────
        // This handles Google Places formatting differences
        // (e.g. "Kukatpally" vs "Kukatpally, Hyderabad")
        pending = pending.filter(o => textMatchOrder(o))
      }

      // Send notifications AND play sound for new pending jobs
      pending.forEach(order => {
        if (!prevPendingIds.current.has(order.id)) {
          notifyTechNewJob(techPushToken.current, order.customerName, order.brand, order.repair).catch(() => {})
          playNewJobSound().catch(() => {})
        }
      })
      prevPendingIds.current = new Set(pending.map(o => o.id))

      // Also attach GPS distance to pending jobs for display
      if (techLat !== 17.3850 || techLng !== 78.4867) {
        pending = pending.map(o => {
          let distKm = null
          if (o.custLat && o.custLng) {
            const d = parseFloat(calcDistance(techLat, techLng, o.custLat, o.custLng))
            if (!isNaN(d)) distKm = d
          }
          return { ...o, gpsDistance: distKm }
        })
      }

      setPending(pending)
      setOngoing(ongoing)
      setCompleted(completed)
      setTotal(count)
      setDailyCompleted(dailyCount)
      if (ongoing) setCustPhone(ongoing.customerPhone || '')
    })

    onValue(ref(db, 'custLocation'), snap => {
      if (!snap.exists()) return
      setCustLat(snap.val().lat)
      setCustLng(snap.val().lng)
    })

    return () => { unsub(); unsubArea() }
  }

  // ── Text-based order matching (fallback when GPS is unavailable) ─────────
  // Checks if order location text contains the tech's area OR vice versa,
  // and if pincodes match (when both are present).
  function textMatchOrder(order) {
    const filterLoc = techLocRef.current
    const filterPincode = techPincodeRef.current

    if (filterLoc) {
      const orderLoc = (order.location || '').toLowerCase().trim()
      if (!orderLoc.includes(filterLoc) && !filterLoc.includes(orderLoc)) {
        return false
      }
    }
    if (filterPincode) {
      const orderPincode = (order.pincode || '').toLowerCase().trim()
      // If the order has no pincode (older orders), still show it
      if (orderPincode && orderPincode !== filterPincode) {
        return false
      }
    }
    return true
  }

  const acceptJob = async (orderId, order) => {
    const name  = await AsyncStorage.getItem('techName')     || 'Technician'
    const loc   = await AsyncStorage.getItem('techLocation') || ''
    const phone = await AsyncStorage.getItem('techPhone')    || ''
    await AsyncStorage.setItem('currentOrderId', orderId)
    set(ref(db, 'techInfo'), { name, location: loc, phone })
    update(ref(db, 'orders/' + orderId), { status: 'accepted', techPhone: phone, techName: name })
      .then(async () => {
        // Claim this area for this technician so future jobs here come to them
        const area = (order.location || '').toLowerCase().trim()
        if (area) {
          set(ref(db, 'areaAssignments/' + area), { name, phone, location: loc })
        }
        // ── If appointment, schedule local notification reminder ──
      if (order.isAppointment && order.appointmentTime) {
        scheduleTechAppointmentReminder(order)
      }
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
          update(ref(db, 'orders/' + orderId), { status: 'completed', completedTime: Date.now() })
          remove(ref(db, 'techLocation'))
          remove(ref(db, 'techInfo'))
          remove(ref(db, 'custLocation'))
          if (watchRef.current) { watchRef.current.remove(); watchRef.current = null }
          if (ongoingJob?.customerPushToken) {
            await notifyCustomerJobDone(ongoingJob.customerPushToken)
          }
          await notifyTechJobDone()
          playJobCompleteSound().catch(() => {})
          Alert.alert('🎉 Job Complete!', 'Great work! Customer will be asked to review.')
        }
      }
    ])
  }

  // ── Schedule local notification for technician appointment reminder ──
  const scheduleTechAppointmentReminder = (order) => {
    try {
      const slotLabel = order.timeSlot || order.time || ''
      const remindAt = new Date(order.appointmentTime - 15 * 60 * 1000)
      if (remindAt > new Date()) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Appointment Reminder',
            body: `Appointment with ${order.customerName} at ${slotLabel} is in 15 minutes!`,
            sound: true,
            data: { screen: 'TechHomeScreen', orderId: order.id },
          },
          trigger: { date: remindAt, channelId: 'dotor-channel' },
        }).catch(() => {})
      }
      // Also schedule one at appointment time
      const apptTime = new Date(order.appointmentTime)
      if (apptTime > new Date()) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: '🔔 Appointment Time!',
            body: `Time for ${order.customerName}'s appointment at ${slotLabel}! Head to ${order.location || 'the customer'}.`,
            sound: true,
            data: { screen: 'TechHomeScreen', orderId: order.id },
          },
          trigger: { date: apptTime, channelId: 'dotor-channel' },
        }).catch(() => {})
      }
    } catch (e) {
      console.log('Failed to schedule tech reminder:', e.message)
    }
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

  const TABS = [
    { key: 'home',     icon: '🏠', label: 'Home' },
    { key: 'pending',  icon: '📋', label: 'Pending' },
    { key: 'completed', icon: '✅', label: 'Completed' },
    { key: 'profile',  icon: '👤', label: 'Profile' },
  ]

  // ── HOME TAB ──
  const renderHomeTab = () => (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* HEADER */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Welcome Back! 👋</Text>
          <Text style={s.name}>{techName}</Text>
          <Text style={s.loc}>📍 Serving {techLoc}</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.avatar} onPress={() => router.push('/screens/TechProfileScreen')}>
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
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statLabel}>Today's Jobs</Text>
          <Text style={s.statNum}>{dailyCompleted}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statLabel}>Pending</Text>
          <Text style={s.statNum}>{pendingJobs.length}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statLabel}>Status</Text>
          <Text style={[s.statNum, { fontSize: 13 }]}>{isOnline ? '🟢 Active' : '🔴 Off'}</Text>
        </View>
      </View>

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
          {ongoingJob.modelName ? <Text style={s.jobLoc}>📲 {ongoingJob.modelName}</Text> : null}
          <Text style={s.jobLoc}>📍 {ongoingJob.location}</Text>
          {ongoingJob.pincode ? <Text style={s.jobLoc}>📮 {ongoingJob.pincode}</Text> : null}
          {ongoingJob.description ? (
            <View style={s.ongoingDesc}>
              <Text style={s.ongoingDescLabel}>📝 Customer's Description:</Text>
              <Text style={s.ongoingDescText}>"{ongoingJob.description}"</Text>
            </View>
          ) : null}

          {/* Ongoing job images — normalized to array in listenOrders */}
          {ongoingJob.images && ongoingJob.images.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {ongoingJob.images.slice(0, 4).map((url, idx) => (
                <TouchableOpacity key={idx} onPress={() => { setFullscreenImgIndex(idx); setFullscreenImages(ongoingJob.images); setFullscreenOrderId(ongoingJob.id) }}>
                  <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: '#eee' }} resizeMode="cover" />
                </TouchableOpacity>
              ))}
              {ongoingJob.images.length > 4 && (
                <Text style={{ fontSize: 10, color: '#888', alignSelf: 'center' }}>+{ongoingJob.images.length - 4}</Text>
              )}
            </View>
          )}

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

          {/* ✅ Safe MapView */}
          {MapView && Marker && (custLat || myLat) && (
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
                  {Polyline && (
                    <Polyline
                      coordinates={[{ latitude: myLat, longitude: myLng }, { latitude: custLat, longitude: custLng }]}
                      strokeColor="#FF6B00" strokeWidth={3} lineDashPattern={[8, 8]}
                    />
                  )}
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
            <TouchableOpacity
              style={s.chatBtn}
              onPress={() => router.push(`/screens/ChatScreen?orderId=${ongoingJob.id}&role=tech&customerName=${encodeURIComponent(ongoingJob.customerName || 'Customer')}&techName=${encodeURIComponent(techName)}`)}
            >
              <Text style={s.chatTxt}>💬 Chat</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.completeBtn} onPress={() => completeJob(ongoingJob.id)}>
            <Text style={s.completeTxt}>✅ Mark Complete</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 90 }} />
    </ScrollView>
  )

  // ── PENDING TAB ──
  const renderPendingTab = () => (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={[s.header, { backgroundColor: '#FF6B00' }]}>
        <View>
          <Text style={s.greeting}>📋 Pending Jobs</Text>
          <Text style={s.name}>{pendingJobs.length} jobs waiting</Text>
        </View>
      </View>

      {pendingJobs.length === 0 ? (
        <View style={{ padding: 50, alignItems: 'center' }}>
          <Text style={{ fontSize: 50, marginBottom: 15 }}>🎉</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A3A6B' }}>All caught up!</Text>
          <Text style={{ fontSize: 13, color: '#888', marginTop: 5 }}>No pending jobs right now</Text>
        </View>
      ) : (
        pendingJobs.map(order => {
          // Show GPS distance if available
          const distDisplay = order.gpsDistance != null
            ? `📍 ${order.gpsDistance.toFixed(1)} km away`
            : null

          return (
            <View key={order.id} style={s.jobCard}>
              <View style={s.newBadge}><Text style={s.newBadgeTxt}>NEW</Text></View>
              <Text style={s.jobCust}>👤 {order.customerName}</Text>
              <Text style={s.jobType}>📱 {order.brand} — {order.repair}</Text>
              {order.modelName ? <Text style={s.jobLoc}>📲 {order.modelName}</Text> : null}
              <Text style={s.jobLoc}>📍 {order.location}</Text>
              {order.pincode ? <Text style={s.jobLoc}>📮 {order.pincode}</Text> : null}
              {order.description ? (
                <View style={s.descTag}>
                  <Text style={s.descTagText}>📝 "{order.description.substring(0, 80)}{order.description.length > 80 ? '...' : ''}"</Text>
                </View>
              ) : null}

              {/* Order images — normalized to array in listenOrders */}
              {order.images && order.images.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
                  {order.images.slice(0, 3).map((url, idx) => (
                    <TouchableOpacity key={idx} onPress={() => { setFullscreenImgIndex(idx); setFullscreenImages(order.images); setFullscreenOrderId(order.id) }}>
                      <Image source={{ uri: url }} style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: '#eee' }} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                  {order.images.length > 3 && (
                    <Text style={{ fontSize: 10, color: '#888', alignSelf: 'center' }}>+{order.images.length - 3}</Text>
                  )}
                </View>
              )}

              <Text style={s.jobTime}>🕐 {order.time}</Text>
              {/* GPS distance display — shows how far the customer is */}
              {distDisplay && (
                <Text style={[s.jobLoc, order.gpsDistance <= AUTO_ASSIGN_RADIUS && s.jobAutoRange]}>
                  {order.gpsDistance <= AUTO_ASSIGN_RADIUS
                    ? `📍 ${order.gpsDistance.toFixed(1)} km (auto-assign range 🎯)`
                    : distDisplay}
                </Text>
              )}
              <View style={s.jobActions}>
                {ongoingJob ? (
                  <View style={{ flex: 1, backgroundColor: '#fff3e0', padding: 10, borderRadius: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#e65100' }}>⚠️ Complete current job first</Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity style={s.rejectBtn} onPress={() => rejectJob(order.id)}>
                      <Text style={s.rejectTxt}>✕ Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.acceptBtn} onPress={() => acceptJob(order.id, order)}>
                      <Text style={s.acceptTxt}>✓ Accept</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
              {order.id && (
                <TouchableOpacity
                  style={s.pendingChatBtn}
                  onPress={() => router.push(`/screens/ChatScreen?orderId=${order.id}&role=tech&customerName=${encodeURIComponent(order.customerName || 'Customer')}&techName=${encodeURIComponent(techName)}`)}
                >
                  <Text style={s.pendingChatTxt}>💬 Chat with Customer</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        })
      )}

      <View style={{ height: 90 }} />
    </ScrollView>
  )

  // ── COMPLETED TAB ──
  const renderCompletedTab = () => (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={[s.header, { backgroundColor: '#FF6B00' }]}>
        <View>
          <Text style={s.greeting}>✅ Completed Jobs</Text>
          <Text style={s.name}>{completedJobs.length} total · {dailyCompleted} today</Text>
        </View>
      </View>

      {completedJobs.length === 0 ? (
        <View style={{ padding: 50, alignItems: 'center' }}>
          <Text style={{ fontSize: 50, marginBottom: 15 }}>📦</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A3A6B' }}>No completed jobs yet</Text>
          <Text style={{ fontSize: 13, color: '#888', marginTop: 5 }}>Your completed jobs will appear here!</Text>
        </View>
      ) : (
        completedJobs.map((order, i) => (
          <View key={i} style={s.completedCard}>
            <View>
              <Text style={s.compCust}>👤 {order.customerName}</Text>
              <Text style={s.compType}>📱 {order.brand} — {order.repair}</Text>
              {order.modelName ? <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>📲 {order.modelName}</Text> : null}
              <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>📍 {order.location}</Text>
              {order.pincode ? <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>📮 {order.pincode}</Text> : null}
              {order.description ? (
                <Text style={{ fontSize: 11, color: '#FF6B00', marginTop: 2, fontStyle: 'italic' }}>
                  📝 "{order.description.substring(0, 50)}{order.description.length > 50 ? '...' : ''}"
                </Text>
              ) : null}
              {/* Completed job images — normalized to array in listenOrders */}
              {order.images && order.images.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                  {order.images.slice(0, 3).map((url, idx) => (
                    <TouchableOpacity key={idx} onPress={() => { setFullscreenImgIndex(idx); setFullscreenImages(order.images); setFullscreenOrderId(order.id) }}>
                      <Image source={{ uri: url }} style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#eee' }} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                  {order.images.length > 3 && (
                    <Text style={{ fontSize: 10, color: '#888', alignSelf: 'center' }}>+{order.images.length - 3}</Text>
                  )}
                </View>
              )}
            </View>
            <View style={s.compRight}>
              <Text style={s.compPrice}>✅ Done</Text>
              <Text style={s.compTime}>{order.time || ''}</Text>
            </View>
          </View>
        ))
      )}

      <View style={{ height: 90 }} />
    </ScrollView>
  )

  {/* FULLSCREEN IMAGE VIEWER with navigation */}
  const renderFullscreenImage = () => {
    const isOpen = fullscreenImgIndex >= 0 && fullscreenImages.length > 0
    const currentUrl = isOpen ? fullscreenImages[fullscreenImgIndex] : null
    const total = fullscreenImages.length

    const goNext = () => {
      if (fullscreenImgIndex < total - 1) {
        setFullscreenImgIndex(fullscreenImgIndex + 1)
      }
    }

    const goPrev = () => {
      if (fullscreenImgIndex > 0) {
        setFullscreenImgIndex(fullscreenImgIndex - 1)
      }
    }

    const close = () => {
      setFullscreenImgIndex(-1)
      setFullscreenImages([])
    }

    return (
      <Modal visible={isOpen} transparent onRequestClose={close}>
        <View style={s.modalOverlay}>
          {/* Close button */}
          <TouchableOpacity style={s.modalClose} onPress={close}>
            <Text style={s.modalCloseTxt}>✕</Text>
          </TouchableOpacity>

          {/* Image counter */}
          {total > 1 && (
            <View style={s.modalCounter}>
              <Text style={s.modalCounterTxt}>{fullscreenImgIndex + 1} / {total}</Text>
            </View>
          )}

          {/* Previous arrow */}
          {total > 1 && fullscreenImgIndex > 0 && (
            <TouchableOpacity style={[s.modalArrow, s.modalArrowLeft]} onPress={goPrev}>
              <Text style={s.modalArrowTxt}>←</Text>
            </TouchableOpacity>
          )}

          {/* Image — key forces remount on navigation */}
          {currentUrl && (
            <Image key={fullscreenImgIndex} source={{ uri: currentUrl }} style={s.modalImage} resizeMode="contain" />
          )}

          {/* Next arrow */}
          {total > 1 && fullscreenImgIndex < total - 1 && (
            <TouchableOpacity style={[s.modalArrow, s.modalArrowRight]} onPress={goNext}>
              <Text style={s.modalArrowTxt}>→</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    )
  }

  // Show loading while navigating to profile
  if (activeTab === 'profile') {
    // Navigate to profile screen when tab is selected
    setTimeout(() => {
      router.push('/screens/TechProfileScreen')
      setActiveTab('home')
    }, 50)
    return <View style={{ flex: 1, backgroundColor: '#f5f5f5' }} />
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {activeTab === 'home' && renderHomeTab()}
      {activeTab === 'pending' && renderPendingTab()}
      {activeTab === 'completed' && renderCompletedTab()}
      {renderFullscreenImage()}
      {/* BOTTOM TAB BAR */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tabItem, activeTab === tab.key && s.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[s.tabIcon, activeTab === tab.key && s.tabIconActive]}>{tab.icon}</Text>
            <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>{tab.label}</Text>
            {tab.key === 'pending' && pendingJobs.length > 0 && (
              <View style={s.tabBadge}>
                <Text style={s.tabBadgeTxt}>{pendingJobs.length > 9 ? '9+' : pendingJobs.length}</Text>
              </View>
            )}
            {activeTab === tab.key && <View style={s.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
  statsRow:   { flexDirection: 'row', gap: 10, margin: 15 },
  statCard:      { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', elevation: 3 },
  statLabel:     { fontSize: 11, color: '#888', fontWeight: '700' },
  statNum:       { fontSize: 18, fontWeight: '800', color: '#1A3A6B', marginTop: 4 },
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
  jobAutoRange:  { color: '#2e7d32', fontWeight: '800' },
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
  chatBtn:       { flex: 1, backgroundColor: '#FF6B00', padding: 12, borderRadius: 12, alignItems: 'center' },
  chatTxt:       { color: '#fff', fontSize: 13, fontWeight: '800' },
  completeBtn:   { backgroundColor: '#1A3A6B', padding: 13, borderRadius: 12, alignItems: 'center' },
  completeTxt:   { color: '#fff', fontSize: 14, fontWeight: '800' },
  pendingChatBtn: { backgroundColor: '#FF6B00', padding: 10, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  pendingChatTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  completedCard: { backgroundColor: '#fff', borderRadius: 14, padding: 15, marginHorizontal: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  // ── Description Styles ──
  descTag:       { backgroundColor: '#fff8e1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4, alignSelf: 'flex-start' },
  descTagText:   { fontSize: 11, color: '#e65100', fontWeight: '600', fontStyle: 'italic' },
  ongoingDesc:   { backgroundColor: '#fff8e1', borderRadius: 10, padding: 10, marginTop: 6 },
  ongoingDescLabel: { fontSize: 11, fontWeight: '800', color: '#e65100', marginBottom: 3 },
  ongoingDescText:  { fontSize: 12, color: '#333', fontStyle: 'italic', lineHeight: 18 },



  compCust:      { fontSize: 13, fontWeight: '800', color: '#1A3A6B' },
  compType:      { fontSize: 12, color: '#888', fontWeight: '600', marginTop: 3 },
  compRight:     { alignItems: 'flex-end' },
  compPrice:     { fontSize: 14, fontWeight: '800', color: '#FF6B00' },
  compTime:      { fontSize: 11, color: '#888', marginTop: 3 },

  // ── Bottom Tab Bar ──
  tabBar:        { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#fff', paddingBottom: 25, paddingTop: 8, elevation: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  tabItem:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, position: 'relative' },
  tabItemActive: {},
  tabIcon:       { fontSize: 22, opacity: 0.5 },
  tabIconActive: { opacity: 1 },
  tabLabel:      { fontSize: 10, fontWeight: '600', color: '#888', marginTop: 2 },
  tabLabelActive:{ color: '#FF6B00', fontWeight: '800' },
  tabIndicator:  { position: 'absolute', top: -1, width: 24, height: 3, backgroundColor: '#FF6B00', borderRadius: 2, alignSelf: 'center' },
  tabBadge:      { position: 'absolute', top: 0, right: '15%', backgroundColor: '#FF6B00', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tabBadgeTxt:   { fontSize: 9, fontWeight: '800', color: '#fff' },

  // ── Fullscreen Image Viewer ──
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  modalClose:     { position: 'absolute', top: 55, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  modalCloseTxt:  { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalCounter:   { position: 'absolute', top: 55, left: 20, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, zIndex: 10 },
  modalCounterTxt:{ color: '#fff', fontSize: 14, fontWeight: '700' },
  modalArrow:     { position: 'absolute', top: 0, bottom: 0, width: 60, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  modalArrowLeft: { left: 0 },
  modalArrowRight:{ right: 0 },
  modalArrowTxt:  { color: 'rgba(255,255,255,0.8)', fontSize: 48, fontWeight: '300' },
  modalImage:     { width: '90%', height: '70%' },
})