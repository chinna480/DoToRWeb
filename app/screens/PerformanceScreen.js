import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { onValue, ref } from 'firebase/database'
import { useEffect, useState } from 'react'
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

  useEffect(() => {
    let unsub = null
    loadReviews()
    return () => {
      if (unsub) unsub()
    }

    async function loadReviews() {
      try {
        const phone = await AsyncStorage.getItem('techPhone')
        if (!phone) {
          setLoading(false)
          return
        }

        // Listen to all reviews and filter by this tech's phone
        unsub = onValue(ref(db, 'reviews'), (snap) => {
          if (!snap.exists()) {
            setReviews([])
            setStats({ average: 0, count: 0, fiveStar: 0 })
            setLoading(false)
            return
          }

          const myReviews = []
          snap.forEach(child => {
            const r = child.val()
            // Match by techPhone (handles +91 prefix variants)
            const cleanTech = (r.techPhone || '').replace('+91', '').replace(/^0+/, '')
            const cleanMy   = phone.replace('+91', '').replace(/^0+/, '')
            if (cleanTech === cleanMy || r.techPhone === phone) {
              myReviews.push({ id: child.key, ...r })
            }
          })

          // Sort by timestamp descending (newest first)
          myReviews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

          // Calculate stats
          const count = myReviews.length
          const totalRating = myReviews.reduce((sum, r) => sum + (r.rating || 0), 0)
          const average = count > 0 ? Math.round((totalRating / count) * 10) / 10 : 0
          const fiveStar = myReviews.filter(r => r.rating === 5).length

          setReviews(myReviews)
          setStats({ average, count, fiveStar })
          setLoading(false)
        })
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

                {review.customerPhone && (
                  <Text style={s.customerPhone}>📱 {review.customerPhone}</Text>
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
  customerPhone:     { fontSize: 11, color: '#aaa', fontWeight: '600', marginTop: 6 },
})
