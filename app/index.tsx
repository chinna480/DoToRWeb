// app/index.js  (or your root entry file)
// Checks if user is already logged in and redirects to correct screen
// Customer → HomeScreen
// Technician → TechHomeScreen
// Nobody → RoleScreen

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    checkLogin()
  }, [])

  const checkLogin = async () => {
    try {
      const custPhone = await AsyncStorage.getItem('custPhone')
      const techPhone = await AsyncStorage.getItem('techPhone')

      if (techPhone) {
        // Technician was logged in
        router.replace('/screens/TechHomeScreen')
      } else if (custPhone) {
        // Customer was logged in
        router.replace('/screens/HomeScreen')
      } else {
        // Nobody logged in — show role screen
        router.replace('/screens/RoleScreen')
      }
    } catch (e) {
      router.replace('/screens/RoleScreen')
    }
  }

  // Show a simple loading spinner while checking
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#FF6B00" />
    </View>
  )
}