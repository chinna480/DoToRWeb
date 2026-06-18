import { useFocusEffect } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { onValue, ref, remove, set, update } from 'firebase/database';
import { Component, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert, Image, Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import MiniMap from '../../components/MiniMap';
import { db } from '../firebase/config';
import { calcDistance } from '../utils/distance';
import {
  notifyCustomerJobDone,
  notifyCustomerTechAccepted,
  notifyCustomerTechArrived,
  notifyCustomerTechNearby,
  notifyTechJobDone,
  notifyTechNewJob,
  playTechJobAlertSound,
  playJobCompleteSound,
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
  const [techCategories, setTechCategories] = useState([]) // tech's service categories
  const [completedFilter, setCompletedFilter] = useState('all') // 'all', 'today', 'week', 'month'
  const [custLat, setCustLat]            = useState(null)
  const [custLng, setCustLng]            = useState(null)
  const [myLat, setMyLat]               = useState(null)
  const [myLng, setMyLng]               = useState(null)
  const [distance, setDistance]          = useState('--')
  const [eta, setEta]                    = useState('--')
  const [etaSeconds, setEtaSeconds]        = useState(null)
  const [countdown, setCountdown]          = useState('--')
  const [currentCustPhone, setCustPhone]   = useState('')

  // Format seconds into readable countdown
  const formatCountdown = (s) => {
    if (s == null || s < 0) return '--'
    if (s === 0) return 'Arriving now!'
    if (s < 60) return s + ' sec'
    const m = Math.floor(s / 60)
    const sec = s % 60
    if (m < 5) return m + ' min ' + sec + ' sec'
    return '~' + m + ' mins'
  }
  const [fsImages, setFsImages]          = useState([])
  const [fsIndex, setFsIndex]            = useState(0)
  const [fsVideos, setFsVideos]          = useState([])
  const [fsVideoIndex, setFsVideoIndex]  = useState(0)
  const [videoLoading, setVideoLoading]  = useState(true)
  const [liveOrderData, setLiveOrderData] = useState(null)
  const miniMapRef = useRef(null)


  const watchRef          = useRef(null)
  const proximityWatchRef = useRef(null)
  const mapRef            = useRef(null)
  const techLatRef        = useRef(null)  // Always up-to-date tech GPS for closures (null until GPS fix acquired)
  const techLngRef        = useRef(null)
  const techPushToken     = useRef(null)
  const techLocRef        = useRef('')
  const techPincodeRef    = useRef('')
  const techPhoneRef      = useRef('')
  const techCatRef        = useRef([]) // e.g. ['mobile', 'tv', 'ac']
  const sentNearby        = useRef(false)
  const sentArrived       = useRef(false)
  const prevPendingIds    = useRef(new Set())
  const areaAssignments   = useRef({})
  const storedEtaRef      = useRef(null)
  const rawPendingRef     = useRef([]) // unfiltered pending orders for re-filter on focus

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

  // Separate ref for profile navigation timer (cleaned up on unmount)
  const profileNavRef = useRef(null)
  useEffect(() => {
    return () => {
      if (profileNavRef.current) {
        clearTimeout(profileNavRef.current)
        profileNavRef.current = null
      }
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
        // Use booking coords (custLat/custLng) — these are the repair destination.
        // Do NOT use custLocation (was live GPS that overwrote booking location).
        if (order.custLat != null && order.custLng != null) {
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
    const mins = Math.max(1, etaMins)
    setDistance(d + ' km')
    setEta('~' + mins + ' mins')
    // Reset countdown from latest ETA estimate
    const secs = mins * 60
    storedEtaRef.current = secs
    setEtaSeconds(secs)
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

  // ── Live countdown timer ────────────────────────────────────────────────
  // Ticks down every second from the latest ETA estimate.
  // Whenever etaSeconds is recalculated (via GPS update), the interval restarts.
  useEffect(() => {
    if (etaSeconds == null) return

    setCountdown(formatCountdown(etaSeconds))

    const interval = setInterval(() => {
      const remaining = Math.max(0, (storedEtaRef.current || 0) - 1)
      storedEtaRef.current = remaining
      setEtaSeconds(remaining)
      setCountdown(formatCountdown(remaining))
      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [etaSeconds])

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

    // Load tech's service categories from AsyncStorage
    try {
      const cats = await AsyncStorage.getItem('techCategories')
      if (cats) {
        const parsed = JSON.parse(cats)
        if (Array.isArray(parsed)) {
          setTechCategories(parsed)
          techCatRef.current = parsed
        }
      }
    } catch (_) {}
  }

  // Filter pending jobs by all criteria — used both by the Firebase listener and on focus refresh
  const filterPendingJobs = useCallback((pendingList) => {
    const myCats = techCatRef.current
    const filterPincode = techPincodeRef.current
    const techLat = techLatRef.current
    const techLng = techLngRef.current
    const myPhone = techPhoneRef.current
    const assignments = areaAssignments.current

    let pending = [...pendingList]

    // Filter by service category
    if (myCats.length > 0) {
      pending = pending.filter(o => {
        const orderCat = o.serviceCategory
        return orderCat && myCats.includes(orderCat)
      })
    }

    // Filter by pincode OR GPS proximity
    if (filterPincode && techLat && techLng) {
      pending = pending.filter(o => {
        const pincodeMatch = (o.pincode || '').toLowerCase().trim() === filterPincode
        if (pincodeMatch) return true
        if (o.custLat == null || o.custLng == null) return false
        const dist = parseFloat(calcDistance(techLat, techLng, o.custLat, o.custLng))
        return dist <= 20
      })
    } else if (filterPincode) {
      pending = pending.filter(o => (o.pincode || '').toLowerCase().trim() === filterPincode)
    } else if (techLat && techLng) {
      pending = pending.filter(o => {
        if (o.custLat == null || o.custLng == null) return true
        const dist = parseFloat(calcDistance(techLat, techLng, o.custLat, o.custLng))
        return dist <= 20
      })
    }

    // Area assignment filter
    pending = pending.filter(o => {
      const area = (o.location || '').toLowerCase().trim()
      const assignedTech = assignments[area]
      if (!area || !assignedTech) return true
      return assignedTech.phone === myPhone
    })

    return pending
  }, [])

  const logout = () => {
    Alert.alert('Logout?', 'Are you sure?', [
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
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      let ongoing = null, count = 0, dailyCount = 0, weekCount = 0, monthCount = 0

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
          // Only count/display jobs completed by THIS technician
          if (order.techPhone === techPhoneRef.current) {
            completed.push(order); count++
            const t = order.completedTime || order.createdAt || 0
            if (t >= todayStart) dailyCount++
            if (t >= weekStart) weekCount++
            if (t >= monthStart) monthCount++
          }
        }
      })

      // Save raw pending data for re-filter on screen focus
      rawPendingRef.current = [...allPending]

      let pending = filterPendingJobs(allPending)

      pending.forEach(order => {
        if (!prevPendingIds.current.has(order.id)) {
          notifyTechNewJob(techPushToken.current, order.customerName, order.brand, order.modelName || order.description || 'repair')
          // 🔔 Play distinct in-app sound alert for new jobs
          playTechJobAlertSound()
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

  // Reload tech categories whenever screen is focused (e.g. after saving SettingsModal)
  // and re-filter pending orders to reflect the new service categories immediately
  useFocusEffect(
    useCallback(() => {
      const refreshCategories = async () => {
        try {
          const cats = await AsyncStorage.getItem('techCategories')
          if (cats) {
            const parsed = JSON.parse(cats)
            if (Array.isArray(parsed)) {
              setTechCategories(parsed)
              techCatRef.current = parsed
            }
          }
        } catch (_) {}

        // Re-filter pending orders with the updated categories
        if (rawPendingRef.current.length > 0) {
          const reFiltered = filterPendingJobs(rawPendingRef.current)
          setPending(reFiltered)
        }
      }
      refreshCategories()
    }, [filterPendingJobs])
  )

  const acceptJob = async (orderId, order) => {
    const name  = await AsyncStorage.getItem('techName')     || 'Technician'
    const phone = await AsyncStorage.getItem('techPhone')    || ''
    await AsyncStorage.setItem('currentOrderId', orderId)

    update(ref(db, 'orders/' + orderId), { status: 'accepted', techPhone: phone, techName: name })
      .then(() => {
        Alert.alert('✅ Job Accepted!', 'Customer can now track you!')
        // Non-critical post-accept tasks (area claim + push notification).
        // Errors here are logged but do NOT show a failure alert to the user,
        // because the order was already successfully accepted.
        acceptJobPostProcess(order, name, phone)
      })
      .catch(() => Alert.alert('Error', 'Failed to accept. Try again!'))
  }

  // Separate function: non-critical tasks after a successful accept.
  // Will NOT throw to the caller — errors are caught internally.
  const acceptJobPostProcess = async (order, name, phone) => {
    try {
      // Claim this area for this technician so future jobs here come to them
      // Sanitize the key to remove characters invalid in Firebase paths (., $, [, ], #, /)
      let area = (order.location || '').toLowerCase().trim()
      area = area.replace(/[.$\[\]#\/]/g, '_')
      if (area) {
        await set(ref(db, 'areaAssignments/' + area), { name, phone, location: order.location || '' })
      }
    } catch (e) {
      console.log('Area claim failed (non-critical):', e.message)
    }

    try {
      if (order.customerPushToken) {
        await notifyCustomerTechAccepted(order.customerPushToken, name)
      }
    } catch (e) {
      console.log('Accept notification failed (non-critical):', e.message)
    }
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
          // ✅ FIX: Remove only this order's location data, not global paths
          remove(ref(db, 'orders/' + orderId + '/techLocation'))
          if (custLocUnsubRef.current) { custLocUnsubRef.current(); custLocUnsubRef.current = null }
          if (watchRef.current) { watchRef.current.remove(); watchRef.current = null }
          if (ongoingJob?.customerPushToken) {
            await notifyCustomerJobDone(ongoingJob.customerPushToken)
          }
          await notifyTechJobDone()
          // 🔊 Play job completion celebration sound
          playJobCompleteSound()
          Alert.alert('🎉 Job Complete!', 'Great work! Customer will be asked to review.')
        }
      }
    ])
  }

  const navigate = () => {
    if (!custLat || !custLng) {
      Alert.alert('Not Available', 'Customer location not available yet!')
      return
    }
    const dest = `${custLat},${custLng}`
    const origin = (myLat && myLng) ? `${myLat},${myLng}` : null
    // Official Google Maps deep link — works on both Android & iOS
    const url = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open Maps. Please install Google Maps.')
    )
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
          {(liveOrderData || ongoingJob).serviceLabel ? <Text style={s.jobCat}>🔧 {(liveOrderData || ongoingJob).serviceLabel}</Text> : null}
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

          {(liveOrderData || ongoingJob).videos && (liveOrderData || ongoingJob).videos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {(liveOrderData || ongoingJob).videos.map((url, j) => (
                <TouchableOpacity key={j} onPress={() => { setFsVideos((liveOrderData || ongoingJob).videos); setFsVideoIndex(j) }}>
                  <View style={s.videoThumb}>
                    <Text style={s.videoPlayIcon}>▶️</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={s.distBanner}>
            <View style={{ flex: 1 }}>
              <Text style={s.distLabel}>Distance to Customer</Text>
              <Text style={s.distVal}>{distance}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={s.countdownRow}>
                <Text style={s.countdownIcon}>⏱️</Text>
                <Text style={s.countdown} numberOfLines={1}>{countdown}</Text>
              </View>
              <View style={s.etaRefreshBadge}>
                <Text style={s.etaRefreshTxt}>LIVE</Text>
              </View>
            </View>
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

          {/* LIVE INTERACTIVE MAP — zoomable, pannable for tech navigation */}
          <MiniMap
            ref={miniMapRef}
            myLat={myLat}
            myLng={myLng}
            targetLat={custLat}
            targetLng={custLng}
            myLabel="You"
            targetLabel={custLat ? 'Customer' : 'Waiting...'}
            myAddress={techLoc}
            targetAddress={(liveOrderData || ongoingJob)?.location}
            distance={distance}
            eta={eta}
            interactive={true}
            onPress={navigate}
          />

          <View style={s.btnRow}>
            <TouchableOpacity style={s.navBtn} onPress={navigate}>
              <Text style={s.navTxt}>🗺️ Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.expandBtn} onPress={() => miniMapRef.current?.openFullScreen()}>
              <Text style={s.expandBtnIcon}>⛶</Text>
              <Text style={s.expandBtnTxt}>Full Screen</Text>
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

  /* ── Full-Screen Video Player Modal ── */
  const renderVideoModal = () => (
    <Modal visible={fsVideos.length > 0} transparent onRequestClose={() => setFsVideos([])}>
      <View style={s.fsOverlay}>
        <TouchableOpacity style={s.fsClose} onPress={() => { setFsVideos([]); setFsVideoIndex(0) }}>
          <Text style={s.fsCloseTxt}>✕</Text>
        </TouchableOpacity>

        <Text style={s.fsCounter}>{fsVideoIndex + 1} / {fsVideos.length}</Text>

        <View style={s.fsContent}>
          {fsVideoIndex > 0 && (
            <TouchableOpacity style={s.fsArrow} onPress={() => setFsVideoIndex(i => i - 1)}>
              <Text style={s.fsArrowTxt}>‹</Text>
            </TouchableOpacity>
          )}

          {fsVideos.length > 0 && (
            <View style={{ flex: 1, height: '70%', justifyContent: 'center', alignItems: 'center' }}>
              <Video
                source={{ uri: fsVideos[fsVideoIndex] }}
                style={{ width: '100%', height: '100%' }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                onLoadStart={() => setVideoLoading(true)}
                onLoad={() => setVideoLoading(false)}
                onError={() => setVideoLoading(false)}
              />
              {videoLoading ? (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#FF6B00" />
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginTop: 10 }}>Loading video...</Text>
                </View>
              ) : null}
            </View>
          )}

          {fsVideoIndex < fsVideos.length - 1 && (
            <TouchableOpacity style={s.fsArrow} onPress={() => setFsVideoIndex(i => i + 1)}>
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
            {order.serviceLabel ? <Text style={s.jobCat}>🔧 {order.serviceLabel}</Text> : null}
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
            {order.videos && order.videos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                {order.videos.map((url, j) => (
                  <TouchableOpacity key={j} onPress={() => { setFsVideos(order.videos); setFsVideoIndex(j) }}>
                    <View style={s.videoThumb}>
                      <Text style={s.videoPlayIcon}>▶️</Text>
                    </View>
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
  const renderCompletedTab = () => {
    // Compute date boundaries for filter
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    // Apply filter to completed jobs
    let filtered = completedJobs
    if (completedFilter === 'today') {
      filtered = completedJobs.filter(j => {
        const t = j.completedTime || j.createdAt || 0
        return t >= todayStart && t < todayStart + 86400000
      })
    } else if (completedFilter === 'week') {
      filtered = completedJobs.filter(j => {
        const t = j.completedTime || j.createdAt || 0
        return t >= weekStart
      })
    } else if (completedFilter === 'month') {
      filtered = completedJobs.filter(j => {
        const t = j.completedTime || j.createdAt || 0
        return t >= monthStart
      })
    }

    // Compute counts for each filter tab
    const allCount = completedJobs.length
    const todayCount = completedJobs.filter(j => {
      const t = j.completedTime || j.createdAt || 0
      return t >= todayStart && t < todayStart + 86400000
    }).length
    const weekCount = completedJobs.filter(j => {
      const t = j.completedTime || j.createdAt || 0
      return t >= weekStart
    }).length
    const monthCount = completedJobs.filter(j => {
      const t = j.completedTime || j.createdAt || 0
      return t >= monthStart
    }).length

    const FILTER_TABS = [
      { key: 'all', label: `All (${allCount})` },
      { key: 'today', label: `Today (${todayCount})` },
      { key: 'week', label: `Week (${weekCount})` },
      { key: 'month', label: `Month (${monthCount})` },
    ]

    return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <View style={[s.header, { backgroundColor: '#FF6B00' }]}>
        <View>
          <Text style={s.greeting}>✅ Completed Jobs</Text>
          <Text style={s.name}>{completedJobs.length} total · {dailyCompleted} today</Text>
        </View>
      </View>

      {/* FILTER TABS */}
      <View style={s.filterRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.filterTab, completedFilter === tab.key && s.filterTabActive]}
            onPress={() => setCompletedFilter(tab.key)}
          >
            <Text style={[s.filterText, completedFilter === tab.key && s.filterTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={{ padding: 50, alignItems: 'center' }}>
          <Text style={{ fontSize: 50, marginBottom: 15 }}>📦</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A3A6B' }}>No completed jobs yet</Text>
          <Text style={{ fontSize: 13, color: '#888', marginTop: 5 }}>Your completed jobs will appear here!</Text>
        </View>
      ) : (
        filtered.map((order, i) => (
          <View key={i} style={s.completedCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.compCust}>👤 {order.customerName}</Text>
              <Text style={s.compType}>📱 {order.brand} {order.modelName ? `— ${order.modelName}` : ''}</Text>
              {order.serviceLabel ? <Text style={{ fontSize: 11, color: '#FF6B00', fontWeight: '700', marginTop: 2 }}>🔧 {order.serviceLabel}</Text> : null}
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
              {order.videos && order.videos.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
                  {order.videos.slice(0, 3).map((url, j) => (
                    <TouchableOpacity key={j} onPress={() => { setFsVideos(order.videos); setFsVideoIndex(j) }}>
                      <View style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#1A3A6B', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 16 }}>▶️</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {order.videos.length > 3 && (
                    <Text style={{ fontSize: 10, color: '#888', alignSelf: 'center' }}>+{order.videos.length - 3}</Text>
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
  }

  // Show loading while navigating to profile
  if (activeTab === 'profile') {
    // Navigate to profile screen when tab is selected
    profileNavRef.current = setTimeout(() => {
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
      {renderVideoModal()}

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
  jobCat:        { fontSize: 12, fontWeight: '700', color: '#FF6B00', marginTop: 4 },
  orderImage:    { width: 70, height: 70, borderRadius: 10, marginRight: 8 },
  videoThumb:    { width: 70, height: 70, borderRadius: 10, marginRight: 8, backgroundColor: '#1A3A6B', alignItems: 'center', justifyContent: 'center' },
  videoPlayIcon: { fontSize: 28 },
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
  countdownRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countdownIcon: { fontSize: 14 },
  countdown:     { color: '#FF6B00', fontSize: 14, fontWeight: '800' },
  etaRefreshBadge:{ backgroundColor: 'rgba(255,107,0,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 2, alignSelf: 'flex-end' },
  etaRefreshTxt: { color: '#FF6B00', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  locRow:        { flexDirection: 'row', gap: 8, marginBottom: 12 },
  locCard:       { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 12, padding: 10, alignItems: 'center' },
  locIcon:       { fontSize: 22 },
  locLabel:      { fontSize: 10, fontWeight: '800', color: '#888', marginTop: 3, letterSpacing: 1 },
  locName:       { fontSize: 11, fontWeight: '800', color: '#1A3A6B', marginTop: 2 },

  map:           { width: '100%', height: 200, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  btnRow:        { flexDirection: 'row', gap: 8, marginBottom: 8 },
  navBtn:        { flex: 1, backgroundColor: '#FF6B00', padding: 12, borderRadius: 12, alignItems: 'center' },
  navTxt:        { color: '#fff', fontSize: 13, fontWeight: '800' },
  expandBtn:     { flex: 1, backgroundColor: '#1A3A6B', padding: 12, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  expandBtnIcon: { color: '#fff', fontSize: 14, fontWeight: '800' },
  expandBtnTxt:  { color: '#fff', fontSize: 11, fontWeight: '800' },
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

  // ── Filter Tabs ──
  filterRow:      { flexDirection: 'row', marginHorizontal: 15, marginTop: 12, marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 2 },
  filterTab:      { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  filterTabActive:{ borderBottomColor: '#FF6B00' },
  filterText:     { fontSize: 11, fontWeight: '700', color: '#888' },
  filterTextActive:{ color: '#FF6B00', fontWeight: '800' },

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