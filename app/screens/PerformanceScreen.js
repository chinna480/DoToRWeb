import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { onValue, ref } from 'firebase/database'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { db } from '../firebase/config'

export default function PerformanceScreen() {
  const router = useRouter()

  const [reviews, setReviews]      = useState([])
  const [loading, setLoading]      = useState(true)
  const [stats, setStats]          = useState({ average: 0, count: 0, fiveStar: 0 })

  // Refs to keep latest data for cross-referencing
  const myPhoneRef = useRef('')
  const allReviewsRef = useRef([])
  const techOrdersRef = useRef([])
  const unsubsRef = useRef([])

  // Merge reviews from direct techPhone match + order cross-reference
  const mergeAndSetReviews = () => {
    const phone = myPhoneRef.current
    if (!phone) return

    const allReviews = allReviewsRef.current
    const techOrders = techOrdersRef.current

    // ── Method 1: Direct techPhone match (for NEW reviews) ──
    const matchedByTechPhone = new Set()
    const directMatches = allReviews.filter(r => {
      const cleanTech = (r.techPhone || '').replace('+91', '').replace(/^0+/, '')
      const cleanMy = phone.replace('+91', '').replace(/^0+/, '')
      const match = cleanTech === cleanMy || r.techPhone === phone
      if (match) matchedByTechPhone.add(r.id)
      return match
    })

    // ── Method 2: Cross-reference with orders (catches OLD reviews without techPhone) ──
    // Match reviews without techPhone to the tech's completed orders by customerName + time
    const orderCustomerMap = {}
    techOrders.forEach(order => {
      const oName = (order.customerName || '').trim().toLowerCase()
      if (!oName) return
      if (!orderCustomerMap[oName]) orderCustomerMap[oName] = []
      orderCustomerMap[oName].push(order)
    })

    const matchedByOrder = []
    allReviews.forEach(r => {
      if (matchedByTechPhone.has(r.id)) return
      // ⛔ Skip reviews that already have a techPhone — they belong to another technician
      if (r.techPhone) return
      const rName = (r.customerName || '').trim().toLowerCase()
      if (!rName) return
      const candidates = orderCustomerMap[rName] || []
      if (candidates.length === 0) return

      if (r.orderId && techOrders.find(o => o.id === r.orderId)) {
        matchedByOrder.push(r)
      } else {
        const rTime = r.createdAt || r.timestamp || 0
        const closeOrders = candidates.filter(o => {
          const oTime = o.createdAt || 0
          return Math.abs(oTime - rTime) < 6 * 60 * 60 * 1000
        })
        if (closeOrders.length > 0) {
          matchedByOrder.push(r)
        }
      }
    })

    // Merge both sets, sort newest-first
    const merged = [...directMatches, ...matchedByOrder].sort(
      (a, b) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0)
    )

    // Deduplicate by review id
    const seen = new Set()
    const uniqueReviews = merged.filter(r => {
      if (!r.id) return true
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    // Calculate stats
    const count = uniqueReviews.length
    const totalRating = uniqueReviews.reduce((sum, r) => sum + (r.rating || 0), 0)
    const average = count > 0 ? Math.round((totalRating / count) * 10) / 10 : 0
    const fiveStar = uniqueReviews.filter(r => r.rating === 5).length

    setReviews(uniqueReviews)
    setStats({ average, count, fiveStar })
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    return () => {
      unsubsRef.current.forEach(fn => { try { fn() } catch(e) {} })
      unsubsRef.current = []
    }

    async function loadData() {
      try {
        const phone = await AsyncStorage.getItem('techPhone')
        if (!phone) {
          setLoading(false)
          return
        }
        myPhoneRef.current = phone

        // ── Listen to all orders (to find completed ones matching this tech) ──
        const unsubOrders = onValue(ref(db, 'orders'), (snap) => {
          if (!snap.exists()) {
            techOrdersRef.current = []
            mergeAndSetReviews()
            return
          }
          const techOrders = []
          snap.forEach(child => {
            const o = { id: child.key, ...child.val() }
            if (o.status === 'completed' && o.techPhone) {
              const cleanTech = (o.techPhone || '').replace('+91', '').replace(/^0+/, '')
              const cleanMy = phone.replace('+91', '').replace(/^0+/, '')
              if (cleanTech === cleanMy || o.techPhone === phone) {
                techOrders.push(o)
              }
            }
          })
          techOrdersRef.current = techOrders
          mergeAndSetReviews()
        })
        unsubsRef.current.push(unsubOrders)

        // ── Listen to all reviews ──
        const unsubReviews = onValue(ref(db, 'reviews'), (snap) => {
          if (!snap.exists()) {
            allReviewsRef.current = []
            mergeAndSetReviews()
            return
          }
          const allReviews = []
          snap.forEach(child => {
            allReviews.push({ id: child.key, ...child.val() })
          })
          allReviewsRef.current = allReviews
          mergeAndSetReviews()
        })
        unsubsRef.current.push(unsubReviews)

      } catch (e) {
        console.error('Performance load error:', e.message)
        setLoading(false)
      }
    }
  }, [])

  const renderStars = (rating) => {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Text key={i} style={[s.star, i <= rating && s.starActive]}>★</Text>
      )
    }
    return stars
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={s.loadingText}>Loading performance...</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f0f0' }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.back} onPress={() => router.back()}>←</Text>
        <Text style={s.headerTitle}>📊 My Performance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Stats Summary Card */}
        <View style={s.statsCard}>
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statBig}>{stats.average}</Text>
              <Text style={s.statLabel}>Avg Rating</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statBig}>{stats.count}</Text>
              <Text style={s.statLabel}>Reviews</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statBig}>{stats.count > 0 ? Math.round((stats.fiveStar / stats.count) * 100) + '%' : '0%'}</Text>
              <Text style={s.statLabel}>5-Star Rate</Text>
            </View>
          </View>
          {stats.count > 0 && (
            <View style={s.avgStarsRow}>
              <Text style={{ fontSize: 18 }}>
                {renderStars(Math.round(stats.average))}
              </Text>
            </View>
          )}
        </View>

        {/* Reviews List */}
        <Text style={s.sectionTitle}>📝 Customer Reviews</Text>

        {reviews.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>📭</Text>
            <Text style={s.emptyTitle}>No Reviews Yet</Text>
            <Text style={s.emptySub}>
              Complete jobs and customers will leave their feedback here.
            </Text>
          </View>
        ) : (
          <View style={s.reviewsContainer}>
            {reviews.map((review, i) => (
              <View key={review.id || i} style={s.reviewCard}>
                <View style={s.reviewHeader}>
                  <View style={s.customerAvatar}>
                    <Text style={s.customerAvatarText}>
                      {(review.customerName || 'C')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.customerInfo}>
                    <Text style={s.customerName}>{review.customerName || 'Customer'}</Text>
                    <Text style={s.reviewDate}>
                      {review.time || (review.timestamp ? new Date(review.timestamp).toLocaleDateString() : '')}
                    </Text>
                  </View>
                  <View style={s.ratingBadge}>
                    <Text style={s.ratingBadgeText}>{review.rating || 0}</Text>
                    <Text style={s.ratingBadgeStar}>⭐</Text>
                  </View>
                </View>

                <View style={s.starsRow}>
                  {renderStars(review.rating || 0)}
                </View>

                {review.comment ? (
                  <Text style={s.commentText}>"{review.comment}"</Text>
                ) : (
                  <Text style={s.noComment}>No comment written</Text>
                )}


              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  center:            { flex: 1, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  loadingText:       { fontSize: 13, color: '#888', marginTop: 12, fontWeight: '600' },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 55, backgroundColor: '#f0f0f0' },
  back:              { fontSize: 24, color: '#1A3A6B', fontWeight: '700' },
  headerTitle:       { fontSize: 20, fontWeight: '800', color: '#111' },

  statsCard:         { backgroundColor: '#fff', borderRadius: 18, marginHorizontal: 15, marginTop: 5, padding: 20, elevation: 4 },
  statsRow:          { flexDirection: 'row' },
  statItem:          { flex: 1, alignItems: 'center' },
  statBig:           { fontSize: 32, fontWeight: '800', color: '#1A3A6B' },
  statLabel:         { fontSize: 11, color: '#888', fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  statDivider:       { width: 1, backgroundColor: '#eee', marginVertical: 4 },
  avgStarsRow:       { alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  sectionTitle:      { fontSize: 16, fontWeight: '800', color: '#111', marginHorizontal: 15, marginTop: 18, marginBottom: 10 },

  emptyCard:         { backgroundColor: '#fff', borderRadius: 18, marginHorizontal: 15, padding: 40, alignItems: 'center', elevation: 2 },
  emptyIcon:         { fontSize: 50, marginBottom: 12 },
  emptyTitle:        { fontSize: 17, fontWeight: '800', color: '#1A3A6B', marginBottom: 6 },
  emptySub:          { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18 },

  reviewsContainer:  { marginHorizontal: 15, gap: 10, marginBottom: 10 },
  reviewCard:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2 },

  reviewHeader:      { flexDirection: 'row', alignItems: 'center' },
  customerAvatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FF6B00', alignItems: 'center', justifyContent: 'center' },
  customerAvatarText:{ fontSize: 18, fontWeight: '800', color: '#fff' },
  customerInfo:      { flex: 1, marginLeft: 12 },
  customerName:      { fontSize: 15, fontWeight: '800', color: '#111' },
  reviewDate:        { fontSize: 11, color: '#aaa', fontWeight: '600', marginTop: 2 },
  ratingBadge:       { backgroundColor: '#fff5ee', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingBadgeText:   { fontSize: 16, fontWeight: '800', color: '#FF6B00' },
  ratingBadgeStar:   { fontSize: 12 },

  starsRow:          { flexDirection: 'row', marginTop: 10, gap: 2 },
  star:              { fontSize: 20, color: '#ddd' },
  starActive:        { color: '#FF6B00' },

  commentText:       { fontSize: 13, color: '#444', fontStyle: 'italic', marginTop: 8, lineHeight: 18, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 10 },
  noComment:         { fontSize: 12, color: '#bbb', marginTop: 8, fontStyle: 'italic' },
})
