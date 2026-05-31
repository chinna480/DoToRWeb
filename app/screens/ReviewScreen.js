import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { ref, update } from 'firebase/database'
import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { db } from '../firebase/config'

export default function ReviewScreen() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('home')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submitReview = async () => {
    if (rating === 0) {
      Alert.alert('Please select a rating!')
      return
    }

    const name = await AsyncStorage.getItem('custName') || 'Customer'

    await update(ref(db, 'reviews/' + Date.now()), {
      customerName: name,
      rating,
      comment,
      time: new Date().toLocaleTimeString(),
    })

    setSubmitted(true)
  }

  const CUST_TABS = [
    { key: 'home',     icon: '🏠', label: 'Home' },
    { key: 'orders',   icon: '📋', label: 'Orders' },
    { key: 'profile',  icon: '👤', label: 'Profile' },
  ]

  const switchTab = (key) => {
    if (key === 'home') { setActiveTab('home'); return }
    if (key === 'orders') { router.push('/screens/HomeScreen'); return }
    if (key === 'profile') { router.push('/screens/CustomerProfileScreen'); return }
  }

  const renderTabBar = () => (
    <View style={s.tabBar}>
      {CUST_TABS.map(tab => (
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
  )

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={s.center}>
          <Text style={s.thankIcon}>🎉</Text>
          <Text style={s.thankTitle}>Thank You!</Text>
          <Text style={s.thankSub}>Your review helps us improve</Text>
          <TouchableOpacity style={s.homeBtn} onPress={() => router.replace('/screens/HomeScreen')}>
            <Text style={s.homeBtnTxt}>Back to Home</Text>
          </TouchableOpacity>
        </View>
        {renderTabBar()}
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <ScrollView style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>⭐ Rate Your Experience</Text>
          <Text style={s.sub}>How was your repair service?</Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>Tap to rate</Text>
          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Text style={[s.star, rating >= star && s.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.ratingLabel}>
            {rating === 0 ? 'No rating yet' : ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'][rating]}
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>Write a comment (optional)</Text>
          <TextInput
            style={s.textArea}
            placeholder="Tell us about your experience..."
            placeholderTextColor="#aaa"
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
          />
        </View>

        <TouchableOpacity style={s.submitBtn} onPress={submitReview}>
          <Text style={s.submitTxt}>Submit Review →</Text>
        </TouchableOpacity>

        <View style={{ height: 90 }} />
      </ScrollView>
      {renderTabBar()}
    </View>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f5' },
  center:      { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 30 },
  header:      { backgroundColor: '#FF6B00', padding: 20, paddingTop: 55, alignItems: 'center' },
  title:       { fontSize: 22, fontWeight: '800', color: '#fff' },
  sub:         { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 5 },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 20, margin: 15, elevation: 3 },
  label:       { fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 1, marginBottom: 14, textTransform: 'uppercase' },
  stars:       { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  star:        { fontSize: 44, color: '#ddd' },
  starActive:  { color: '#FF6B00' },
  ratingLabel: { textAlign: 'center', marginTop: 10, fontSize: 14, fontWeight: '700', color: '#1A3A6B' },
  textArea:    { borderWidth: 2, borderColor: '#eee', borderRadius: 12, padding: 12, fontSize: 14, color: '#1A3A6B', minHeight: 100, textAlignVertical: 'top' },
  submitBtn:   { backgroundColor: '#FF6B00', padding: 16, borderRadius: 14, alignItems: 'center', marginHorizontal: 15 },
  submitTxt:   { color: '#fff', fontSize: 16, fontWeight: '800' },
  thankIcon:   { fontSize: 60 },
  thankTitle:  { fontSize: 26, fontWeight: '800', color: '#1A3A6B', marginTop: 15 },
  thankSub:    { fontSize: 14, color: '#888', marginTop: 8 },
  homeBtn:     { backgroundColor: '#FF6B00', padding: 15, borderRadius: 14, alignItems: 'center', marginTop: 30, width: '100%' },
  homeBtnTxt:  { color: '#fff', fontSize: 16, fontWeight: '800' },
})