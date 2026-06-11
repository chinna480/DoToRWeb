import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { onValue, ref, remove, set, update } from 'firebase/database';
import { Component, useEffect, useRef, useState } from 'react';
import {
  Alert, Image, Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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

// ═══════════════════════════════════════════════════════════════════════════
// Local error boundary — catches rendering crashes so the app doesn't close
// ═══════════════════════════════════════════════════════════════════════════
class TechHomeErrorBoundary extends Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error) { console.error('TechHomeScreen crash:', error?.message) }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <Text style={{ fontSize: 50, marginBottom: 16 }}>🔧</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A3A6B', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24 }}>
            {this.state.error?.message || 'An unexpected error occurred on the home screen.'}
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
class MapErrorBoundaryTech extends Component {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  componentDidCatch(error) { console.error('TechHomeScreen MapView crash:', error?.message) }
  render() {
    if (this.state.crashed) {
      return (
        <View style={{ height: 200, backgroundColor: '#1A3A6B', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
          <Text style={{ fontSize: 40 }}>🗺️</Text>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }}>
            Map temporarily unavailable
          </Text>
        </View>
      )
    }
    return this.props.children
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
  const [fsImages, setFsImages]          = useState([])
  const [fsIndex, setFsIndex]            = useState(0)
  const [liveOrderData, setLiveOrderData] = useState(null)
  // ── Lazy-loaded map components (loaded AFTER first render to prevent module-level crash) ──
  const [MapViewCmp, setMapViewCmp] = useState(null)
  const [MarkerCmp, setMarkerCmp]   = useState(null)
  const [PolylineCmp, setPolylineCmp] = useState(null)
  useEffect(() => {
    let cancelled = false
    try {
      const Maps = require('react-native-maps')
      if (!cancelled) {
        setMapViewCmp(() => Maps.default || null)
        setMarkerCmp(() => Maps.Marker || null)
        setPolylineCmp(() => Maps.Polyline || null)
      }
    } catch (e) {
      console.log('react-native-maps not available (TechHomeScreen):', e?.message)
    }
    return () => { cancelled = true }
  }, [])

  const watchRef          = useRef(null)
  const proximityWatchRef = useRef(null)
  const mapRef            = useRef(null)
  const techLatRef        = useRef(null)  // Always up-to-date tech GPS for closures (null until GPS fix acquired)
  const techLngRef        = useRef(null)
  const techPushToken     = useRef(null)
  const techLocRef        = useRef('')
  const techPincodeRef    = useRef('')
  const techPhoneRef      = useRef('')
  const sentNearby        = useRef(false)
  const sentArrived       = useRef(false)
  const prevPendingIds    = useRef(new Set())
  const areaAssignments   = useRef({})

  useEffect(() => {
    let unsub
    let cancelled = false
    loadTech().then(() => {
      if (!cancelled) unsub = listenOrders()
    })
    return () => {
      cancelled = true
      if (unsub) unsub()
      if (watchRef.current) watchRef.current.remove()
      if (proximityWatchRef.current) proximityWatchRef.current.remove()
    }
  }, [])

  const custLocUnsubRef = useRef(null)

  useEffect(() => {
    if (ongoingJob) {
      startLocationSharing(ongoingJob.id)
      if (custLocUnsubRef.current) custLocUnsubRef.current()
      custLocUnsubRef.current = onValue(ref(db, 'orders/' + ongoingJob.id), snap => {
        if (!snap.exists()) return
        const order = { id: snap.key, ...snap.val() }
        // Normalize images from Firebase (stored as objects {0:"url",1:"url"})
        if (order.images && !Array.isArray(order.images)) {
          order.images = typeof order.images === 'string' ? [order.images] : Object.values(order.images).filter(v => typeof v === 'string')
        }
        // Store full live order data so the ongoing card stays current (images, status, etc.)
        setLiveOrderData(order)
        // Prioritize nested custLocation (live GPS from customer's TrackingScreen)
        if (order.custLocation && typeof order.custLocation.lat === 'number' && typeof order.custLocation.lng === 'number') {
          setCustLat(order.custLocation.lat)
          setCustLng(order.custLocation.lng)
        } else if (order.custLat != null && order.custLng != null) {
          // Fallback to top-level fields from initial booking
          setCustLat(order.custLat)
          setCustLng(order.custLng)
        }
      }, err => console.log('custLocation listener error:', err))
      sentNearby.current  = false
      sentArrived.current = false
    } else {
      if (watchRef.current) { watchRef.current.remove(); watchRef.current = null }
      if (custLocUnsubRef.current) { custLocUnsubRef.current(); custLocUnsubRef.current = null }
      setLiveOrderData(null)
      // Restart proximity GPS watcher for pending-job matching
      startProximityWatching()
    }
  }, [ongoingJob])

  useEffect(() => {
    if (!custLat || !myLat || !ongoingJob) return
    const d = parseFloat(calcDistance(myLat, myLng, custLat, custLng))
    if (isNaN(d)) return
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

  const startLocationSharing = async (orderId) => {
    if (watchRef.current) return
    // Stop proximity watcher before starting high-accuracy watcher
    if (proximityWatchRef.current) { proximityWatchRef.current.remove(); proximityWatchRef.current = null }
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 4000 },
      pos => {
        try {
          if (!pos || !pos.coords || typeof pos.coords.latitude !== 'number' || typeof pos.coords.longitude !== 'number') return
          const lat = pos.coords.latitude, lng = pos.coords.longitude
          setMyLat(lat); setMyLng(lng)
          techLatRef.current = lat; techLngRef.current = lng
          // ✅ FIX: Write under this specific order, not global techLocation
          if (orderId) set(ref(db, 'orders/' + orderId + '/techLocation'), { lat, lng }).catch(() => {})
        } catch (e) {
          console.log('startLocationSharing GPS callback error:', e)
        }
      }
    )
  }

  /** Start low-accuracy GPS watcher for proximity-based pending job matching (20 km radius) */
  const startProximityWatching = async () => {
    if (proximityWatchRef.current || watchRef.current) return
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return
    proximityWatchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 30000 },
      pos => {
        try {
          if (!pos || !pos.coords || typeof pos.coords.latitude !== 'number' || typeof pos.coords.longitude !== 'number') return
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          setMyLat(lat); setMyLng(lng)
          techLatRef.current = lat; techLngRef.current = lng
        } catch (e) {
          console.log('startProximityWatching GPS callback error:', e)
        }
      }
    )
  }

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
        // Guard: skip if order data is not an object (prevents crash from corrupt data)
        if (!val || typeof val !== 'object') return
        const order = { id: child.key, ...val }
        // Normalize images from Firebase (stored as objects {0:"url",1:"url"})
        if (order.images && !Array.isArray(order.images)) {
          order.images = typeof order.images === 'string' ? [order.images] : Object.values(order.images).filter(v => typeof v === 'string')
        }
        if (order.status === 'pending')   allPending.push(order)
        if (order.status === 'accepted') {
          // Only mark as ongoing if THIS tech accepted the job
          if (order.techPhone === techPhoneRef.current) ongoing = order
        }
        if (order.status === 'completed') {
          completed.push(order); count++
          dailyCount++
        }
      })

      // Filter pending jobs by technician's pincode + GPS proximity (20 km radius)
      const filterPincode = techPincodeRef.current
      const techLat = techLatRef.current  // use refs — state is stale in closures
      const techLng = techLngRef.current
      const myPhone       = techPhoneRef.current
      const assignments   = areaAssignments.current

      let pending = allPending
      if (filterPincode) {
        pending = pending.filter(o => (o.pincode || '').toLowerCase().trim() === filterPincode)
      }

      // Filter by GPS proximity — only show orders within 20 km of technician's current location
      // Orders without GPS coordinates are still shown (e.g., website bookings where customer didn't share GPS)
      if (techLat && techLng) {
        pending = pending.filter(o => {
          if (o.custLat == null || o.custLng == null) return true // No GPS → still show (website orders)
          const dist = parseFloat(calcDistance(techLat, techLng, o.custLat, o.custLng))
          return dist <= 20 // within 20 km radius
        })
      }

      // If an area is already assigned to a different technician, exclude those jobs
      // so only the assigned technician sees them
      pending = pending.filter(o => {
        const area = (o.location || '').toLowerCase().trim()
        const assignedTech = assignments[area]
        if (!area || !assignedTech) return true // No assignment → anyone can take it
        // If assigned to this tech → show it
        return assignedTech.phone === myPhone
      })

      pending.forEach(order => {
        if (!prevPendingIds.current.has(order.id)) {
          notifyTechNewJob(techPushToken.current, order.customerName, order.brand, order.modelName || order.description || 'repair')
        }
      })
      prevPendingIds.current = new Set(pending.map(o => o.id))

      setPending(pending)
      setOngoing(ongoing)
      setCompleted(completed)
      setTotal(count)
      setDailyCompleted(dailyCount)
      if (ongoing) setCustPhone(ongoing.customerPhone || '')
    })

    // ✅ FIX: custLocation is now per-order — listened when ongoingJob changes (see useEffect)
    // Global custLocation listener removed to prevent wrong customer data

    return () => { unsub(); unsubArea() }
  }

  const acceptJob = async (orderId, order) => {
    const name  = await AsyncStorage.getItem('techName')     || 'Technician'
    const loc   = await AsyncStorage.getItem('techLocation') || ''
    const phone = await AsyncStorage.getItem('techPhone')    || ''
    await AsyncStorage.setItem('currentOrderId', orderId)
    // ✅ FIX: Removed global techInfo — tech details stored on order directly
    update(ref(db, 'orders/' + orderId), { status: 'accepted', techPhone: phone, techName: name })
      .then(async () => {
        // Claim this area for this technician so future jobs here come to them
        const area = (order.location || '').toLowerCase().trim()
        if (area) {
          set(ref(db, 'areaAssignments/' + area), { name, phone, location: loc })
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
          update(ref(db, 'orders/' + orderId), { status: 'completed' })
          // ✅ FIX: Remove only this order's location data, not global paths
          remove(ref(db, 'orders/' + orderId + '/techLocation'))
          remove(ref(db, 'orders/' + orderId + '/custLocation'))
          if (custLocUnsubRef.current) { custLocUnsubRef.current(); custLocUnsubRef.current = null }
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
    if (currentCustPhone) {
      const cleanPhone = currentCustPhone.replace(/[^0-9]/g, '')
      if (cleanPhone.length < 10) {
        Alert.alert('Not Available', 'Customer phone number is not valid.')
        return
      }
      Linking.openURL('tel:+91' + cleanPhone)
    } else {
      Alert.alert('Not Available', 'Customer phone not available!')
    }
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
      <View style={s.earningsRow}>
        <View style={s.earnCard}>
          <Text style={s.earnLabel}>Today's Jobs</Text>
          <Text style={s.earnAmt}>{dailyCompleted}</Text>
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

      {/* ONGOING JOB — liveOrderData keeps fields current from Firebase */}
      <Text style={s.sectionTitle}>🔧 Ongoing Job</Text>
      {!ongoingJob ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyTxt}>No ongoing job right now</Text>
        </View>
      ) : (
        <View style={s.ongoingCard}>
          <Text style={s.jobCust}>👤 {(liveOrderData || ongoingJob).customerName}</Text>
          <Text style={s.jobType}>📱 {(liveOrderData || ongoingJob).brand} {(liveOrderData || ongoingJob).modelName ? `— ${(liveOrderData || ongoingJob).modelName}` : ''}</Text>
          {(liveOrderData || ongoingJob).description ? <Text style={s.jobDesc}>📝 {(liveOrderData || ongoingJob).description}</Text> : null}
          <Text style={s.jobLoc}>📍 {(liveOrderData || ongoingJob).location}</Text>
          {(liveOrderData || ongoingJob).pincode ? <Text style={s.jobLoc}>📮 {(liveOrderData || ongoingJob).pincode}</Text> : null}
          <Text style={s.inProgressTxt}>⚡ In Progress...</Text>

          {(liveOrderData || ongoingJob).images && (liveOrderData || ongoingJob).images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {(liveOrderData || ongoingJob).images.map((url, j) => (
                <TouchableOpacity key={j} onPress={() => { setFsImages((liveOrderData || ongoingJob).images); setFsIndex(j) }}>
                  <Image source={{ uri: url }} style={s.orderImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

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

          {/* Safe map — lazily loaded to prevent module-level crash */}
          <MapErrorBoundaryTech>
          {MapViewCmp && MarkerCmp && (custLat || myLat) ? (
            <MapViewCmp
              ref={mapRef}
              style={s.map}
              region={{
                latitude:      (myLat + (custLat || myLat)) / 2,
                longitude:     (myLng + (custLng || myLng)) / 2,
                latitudeDelta:  0.05,
                longitudeDelta: 0.05,
              }}
            >
              <MarkerCmp coordinate={{ latitude: myLat, longitude: myLng }} title="🛵 You" pinColor="#1A3A6B" />
              {custLat && (
                <>
                  <MarkerCmp coordinate={{ latitude: custLat, longitude: custLng }} title="🏠 Customer" />
                  {PolylineCmp && (
                    <PolylineCmp
                      coordinates={[{ latitude: myLat, longitude: myLng }, { latitude: custLat, longitude: custLng }]}
                      strokeColor="#FF6B00" strokeWidth={3} lineDashPattern={[8, 8]}
                    />
                  )}
                </>
              )}
            </MapViewCmp>
          ) : null}
          </MapErrorBoundaryTech>

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

      {/* QUICK ACTIONS */}
      <Text style={s.sectionTitle}>⚡ Quick Actions</Text>
      <View style={s.quickRow}>
        <TouchableOpacity style={s.quickCard} onPress={() => setActiveTab('pending')}>
          <Text style={s.quickIcon}>📋</Text>
          <Text style={s.quickLabel}>Pending Jobs</Text>
          <View style={s.quickBadge}><Text style={s.quickBadgeTxt}>{pendingJobs.length}</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={s.quickCard} onPress={() => setActiveTab('completed')}>
          <Text style={s.quickIcon}>✅</Text>
          <Text style={s.quickLabel}>Completed</Text>
          <Text style={s.quickSub}>{dailyCompleted} today</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.quickCard} onPress={logout}>
          <Text style={s.quickIcon}>🚪</Text>
          <Text style={s.quickLabel}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  )

  /* ── Full-Screen Image Viewer Modal (with forward/backward nav) ── */
  const renderImageModal = () => (
    <Modal visible={fsImages.length > 0} transparent onRequestClose={() => setFsImages([])}>
      <View style={s.fsOverlay}>
        <TouchableOpacity style={s.fsClose} onPress={() => setFsImages([])}>
          <Text style={s.fsCloseTxt}>✕</Text>
        </TouchableOpacity>

        <Text style={s.fsCounter}>{fsIndex + 1} / {fsImages.length}</Text>

        <View style={s.fsContent}>
          {fsIndex > 0 && (
            <TouchableOpacity style={s.fsArrow} onPress={() => setFsIndex(i => i - 1)}>
              <Text style={s.fsArrowTxt}>‹</Text>
            </TouchableOpacity>
          )}

          {fsImages.length > 0 && (
            <Image source={{ uri: fsImages[fsIndex] }} style={s.fsImage} resizeMode="contain" />
          )}

          {fsIndex < fsImages.length - 1 && (
            <TouchableOpacity style={s.fsArrow} onPress={() => setFsIndex(i => i + 1)}>
              <Text style={s.fsArrowTxt}>›</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
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
        pendingJobs.map(order => (
          <View key={order.id} style={s.jobCard}>
            <View style={s.newBadge}><Text style={s.newBadgeTxt}>NEW</Text></View>
            <Text style={s.jobCust}>👤 {order.customerName}</Text>
            <Text style={s.jobType}>📱 {order.brand} {order.modelName ? `— ${order.modelName}` : ''}</Text>
            {order.description ? <Text style={s.jobDesc}>📝 {order.description}</Text> : null}
            <Text style={s.jobLoc}>📍 {order.location}</Text>
            {order.pincode ? <Text style={s.jobLoc}>📮 {order.pincode}</Text> : null}
            {order.images && order.images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                {order.images.map((url, j) => (
                  <TouchableOpacity key={j} onPress={() => { setFsImages(order.images); setFsIndex(j) }}>
                    <Image source={{ uri: url }} style={s.orderImage} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <Text style={s.jobTime}>🕐 {order.time}</Text>
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
        ))
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
            <View style={{ flex: 1 }}>
              <Text style={s.compCust}>👤 {order.customerName}</Text>
              <Text style={s.compType}>📱 {order.brand} {order.modelName ? `— ${order.modelName}` : ''}</Text>
              {order.description ? <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>📝 {order.description}</Text> : null}
              <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>📍 {order.location}</Text>
              {order.pincode ? <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>📮 {order.pincode}</Text> : null}
              {order.images && order.images.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
                  {order.images.slice(0, 3).map((url, j) => (
                    <TouchableOpacity key={j} onPress={() => { setFsImages(order.images); setFsIndex(j) }}>
                      <Image source={{ uri: url }} style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#eee' }} />
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
    <TechHomeErrorBoundary>
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {activeTab === 'home' && renderHomeTab()}
      {activeTab === 'pending' && renderPendingTab()}
      {activeTab === 'completed' && renderCompletedTab()}

      {renderImageModal()}

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
    </TechHomeErrorBoundary>
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
  jobDesc:       { fontSize: 12, color: '#555', fontWeight: '600', marginTop: 3, fontStyle: 'italic' },
  jobLoc:        { fontSize: 12, color: '#888', fontWeight: '600', marginTop: 3 },
  orderImage:    { width: 70, height: 70, borderRadius: 10, marginRight: 8 },
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
  chatBtn:       { flex: 1, backgroundColor: '#FF6B00', padding: 12, borderRadius: 12, alignItems: 'center' },
  chatTxt:       { color: '#fff', fontSize: 13, fontWeight: '800' },
  completeBtn:   { backgroundColor: '#1A3A6B', padding: 13, borderRadius: 12, alignItems: 'center' },
  completeTxt:   { color: '#fff', fontSize: 14, fontWeight: '800' },
  pendingChatBtn: { backgroundColor: '#FF6B00', padding: 10, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  pendingChatTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  completedCard: { backgroundColor: '#fff', borderRadius: 14, padding: 15, marginHorizontal: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  compCust:      { fontSize: 13, fontWeight: '800', color: '#1A3A6B' },
  compType:      { fontSize: 12, color: '#888', fontWeight: '600', marginTop: 3 },
  compRight:     { alignItems: 'flex-end' },
  compPrice:     { fontSize: 14, fontWeight: '800', color: '#FF6B00' },
  compTime:      { fontSize: 11, color: '#888', marginTop: 3 },

  // ── Quick Actions ──
  quickRow:      { flexDirection: 'row', gap: 10, marginHorizontal: 15, marginBottom: 20 },
  quickCard:     { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', elevation: 3, position: 'relative' },
  quickIcon:     { fontSize: 28 },
  quickLabel:    { fontSize: 11, fontWeight: '700', color: '#1A3A6B', marginTop: 6 },
  quickSub:      { fontSize: 10, color: '#888', marginTop: 2 },
  quickBadge:    { position: 'absolute', top: 6, right: 6, backgroundColor: '#FF6B00', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },

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

  // ── Full-screen Image Modal ──
  fsOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  fsClose:        { position: 'absolute', top: 55, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  fsCloseTxt:     { color: '#fff', fontSize: 18, fontWeight: '800' },
  fsCounter:      { position: 'absolute', top: 60, left: 20, color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700', zIndex: 10 },
  fsContent:      { flexDirection: 'row', alignItems: 'center', width: '100%', height: '100%' },
  fsArrow:        { width: 50, height: '60%', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  fsArrowTxt:     { color: '#fff', fontSize: 48, fontWeight: '300', opacity: 0.8 },
  fsImage:        { flex: 1, height: '70%' },
})