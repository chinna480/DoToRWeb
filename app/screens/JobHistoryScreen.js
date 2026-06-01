// JobHistoryScreen.js — Full job history for technicians
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { onValue, ref } from 'firebase/database'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { db } from '../firebase/config'
import OrderImage from '../../components/OrderImage'

export default function JobHistoryScreen() {
  const router = useRouter()
  const [jobs, setJobs] = useState([])
  const [filter, setFilter] = useState('all') // 'all', 'today', 'week', 'month'
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({ total: 0, today: 0, week: 0, month: 0 })
  const [fullscreenImg, setFullscreenImg] = useState(null)
  const loadUnsub = useRef(null)

  useEffect(() => {
    loadJobHistory()
    return () => {
      if (loadUnsub.current) loadUnsub.current()
    }
  }, [])

  const loadJobHistory = async () => {
    const myPhone = await AsyncStorage.getItem('techPhone')
    if (!myPhone) return

    loadUnsub.current = onValue(ref(db, 'orders'), snap => {
      if (!snap.exists()) { setJobs([]); return }

      const allJobs = []
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

      let todayCount = 0, weekCount = 0, monthCount = 0

      /**
       * Convert various Firebase RTDB image formats to a real JavaScript array.
       * Handles arrays, objects with numeric keys (Firebase RTDB format), null.
       */
      const toArr = (v) => {
        if (!v) return null
        if (Array.isArray(v)) {
          const filtered = v.filter(x => typeof x === 'string' && x.startsWith('http'))
          return filtered.length > 0 ? filtered : null
        }
        if (typeof v === 'object') {
          const values = Object.values(v)
          const strings = values.filter(x => typeof x === 'string' && x.startsWith('http'))
          return strings.length > 0 ? strings : null
        }
        return null
      }

      snap.forEach(child => {
        const val = child.val()
        const o = { id: child.key, ...val, images: toArr(val.images) }
        if (o.techPhone === myPhone && (o.status === 'completed' || o.status === 'accepted')) {
          // Try to parse order time for date-based filtering
          let orderTime = 0
          if (o.time) {
            // time stored as locale time string, approximate by using current date
            orderTime = now.getTime()
          }
          // Use autoAssignTime or fallback to current time for filtering
          const t = o.autoAssignTime || o.completedTime || orderTime || now.getTime()
          
          if (t >= todayStart) todayCount++
          if (t >= weekStart) weekCount++
          if (t >= monthStart) monthCount++

          allJobs.push({
            ...o,
            _timestamp: t,
            _date: new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            _time: o.time || new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          })
        }
      })

      // Sort by most recent first
      allJobs.sort((a, b) => b._timestamp - a._timestamp)

      setJobs(allJobs)
      setStats({
        total: allJobs.length,
        today: todayCount,
        week: weekCount,
        month: monthCount
      })
    })
  }

  // Apply filters
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  let filtered = jobs
  if (filter === 'today') filtered = jobs.filter(j => j._timestamp >= todayStart)
  else if (filter === 'week') filtered = jobs.filter(j => j._timestamp >= weekStart)
  else if (filter === 'month') filtered = jobs.filter(j => j._timestamp >= monthStart)

  if (search.trim()) {
    const q = search.toLowerCase().trim()
    filtered = filtered.filter(j =>
      (j.customerName || '').toLowerCase().includes(q) ||
      (j.brand || '').toLowerCase().includes(q) ||
      (j.repair || '').toLowerCase().includes(q) ||
      (j.location || '').toLowerCase().includes(q)
    )
  }

  const FILTER_TABS = [
    { key: 'all', label: `All (${stats.total})` },
    { key: 'today', label: `Today (${stats.today})` },
    { key: 'week', label: `Week (${stats.week})` },
    { key: 'month', label: `Month (${stats.month})` },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f0f0' }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>📋 Job History</Text>
            <Text style={s.headerSub}>{stats.total} total jobs</Text>
          </View>
        </View>

        {/* SEARCH */}
        <View style={s.searchBar}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search customer, brand, repair..."
            placeholderTextColor="#aaa"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ fontSize: 18, color: '#888' }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* FILTER TABS */}
        <View style={s.filterRow}>
          {FILTER_TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.filterTab, filter === tab.key && s.filterTabActive]}
              onPress={() => setFilter(tab.key)}
            >
              <Text style={[s.filterText, filter === tab.key && s.filterTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* JOB LIST */}
        {filtered.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 50, marginBottom: 15 }}>📦</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A3A6B' }}>No jobs found</Text>
            <Text style={{ fontSize: 13, color: '#888', marginTop: 5 }}>
              {search ? 'Try a different search term' : 'Complete your first job to see it here!'}
            </Text>
          </View>
        ) : (
          filtered.map((job, i) => (
            <TouchableOpacity
              key={job.id || i}
              style={s.jobCard}
              onPress={() => {
                Alert.alert(
                  `${job.customerName}'s ${job.brand} ${job.repair}`,
                  `📍 ${job.location}${job.pincode ? `\n📮 ${job.pincode}` : ''}\n🕐 ${job._date} at ${job._time}\n📱 ${job.brand} — ${job.repair}\n💰 ₹299${job.description ? `\n📝 Description: ${job.description}` : ''}\n📋 ${job.status === 'completed' ? '✅ Completed' : '🔧 In Progress'}`,
                  [{ text: 'OK' }]
                )
              }}
            >
              <View style={s.jobLeft}>
                <View style={[s.statusDot, { backgroundColor: job.status === 'completed' ? '#2e7d32' : '#FF6B00' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.jobCust}>👤 {job.customerName}</Text>
                  <Text style={s.jobType}>📱 {job.brand} — {job.repair}</Text>
                  <Text style={s.jobLoc}>📍 {job.location}</Text>
                  {job.description ? (
                    <Text style={s.jobDesc}>📝 "{job.description.substring(0, 60)}{job.description.length > 60 ? '...' : ''}"</Text>
                  ) : null}
                  {/* ── Job images ── */}
                  {job.images && job.images.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                      {job.images.slice(0, 3).map((img, i) => (
                        <TouchableOpacity key={i} onPress={() => setFullscreenImg(img)}>
                          <OrderImage uri={img} style={s.jobHistImgThumb} />
                        </TouchableOpacity>
                      ))}
                      {job.images.length > 3 && (
                        <Text style={{ fontSize: 10, color: '#888', alignSelf: 'center' }}>+{job.images.length - 3}</Text>
                      )}
                    </View>
                  )}
                  <Text style={s.jobDate}>📅 {job._date} · {job._time}</Text>
                </View>
              </View>
              <View style={s.jobRight}>
                <Text style={s.jobAmt}>₹299</Text>
                <View style={[s.statusBadge, { backgroundColor: job.status === 'completed' ? '#e8f5e9' : '#fff3e0' }]}>
                  <Text style={[s.statusText, { color: job.status === 'completed' ? '#2e7d32' : '#e65100' }]}>
                    {job.status === 'completed' ? '✅ Done' : '🔧 Active'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Fullscreen Image Viewer ── */}
      <Modal visible={!!fullscreenImg} transparent onRequestClose={() => setFullscreenImg(null)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={s.modalClose} onPress={() => setFullscreenImg(null)}>
            <Text style={s.modalCloseTxt}>✕</Text>
          </TouchableOpacity>
          {fullscreenImg && (
            <OrderImage uri={fullscreenImg} style={s.modalImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  header:         { flexDirection: 'row', alignItems: 'center', gap: 15, padding: 20, paddingTop: 55, backgroundColor: '#1A3A6B' },
  back:           { fontSize: 24, color: '#fff', fontWeight: '700' },
  headerTitle:    { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub:      { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  searchBar:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', margin: 15, padding: 12, borderRadius: 14, elevation: 3 },
  searchInput:    { flex: 1, fontSize: 13, color: '#333' },
  filterRow:      { flexDirection: 'row', marginHorizontal: 15, marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 2 },
  filterTab:      { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  filterTabActive:{ borderBottomColor: '#FF6B00' },
  filterText:     { fontSize: 11, fontWeight: '700', color: '#888' },
  filterTextActive:{ color: '#FF6B00', fontWeight: '800' },
  emptyState:     { padding: 50, alignItems: 'center' },
  jobCard:        { backgroundColor: '#fff', borderRadius: 14, padding: 15, marginHorizontal: 15, marginBottom: 10, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#FF6B00', flexDirection: 'row', justifyContent: 'space-between' },
  jobLeft:        { flex: 1, flexDirection: 'row', gap: 10 },
  statusDot:      { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  jobCust:        { fontSize: 13, fontWeight: '800', color: '#1A3A6B' },
  jobType:        { fontSize: 12, color: '#FF6B00', fontWeight: '700', marginTop: 2 },
  jobLoc:         { fontSize: 11, color: '#888', marginTop: 2 },
  jobDesc:        { fontSize: 11, color: '#e65100', fontStyle: 'italic', fontWeight: '600', marginTop: 2, backgroundColor: '#fff8e1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  jobDate:        { fontSize: 11, color: '#888', marginTop: 2 },
  jobRight:       { alignItems: 'flex-end', gap: 6, justifyContent: 'center' },
  jobAmt:         { fontSize: 16, fontWeight: '800', color: '#2e7d32' },
  statusBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText:     { fontSize: 11, fontWeight: '800' },
  jobHistImgThumb: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#eee' },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  modalClose:     { position: 'absolute', top: 55, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  modalCloseTxt:  { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalImage:     { width: '90%', height: '70%' },
})
