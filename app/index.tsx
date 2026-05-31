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
        router.replace('/screens/TechHomeScreen')
      } else if (custPhone) {
        router.replace('/screens/HomeScreen')
      } else {
        router.replace('/screens/RoleScreen')
      }
    } catch (e) {
      router.replace('/screens/RoleScreen')
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#FF6B00" />
    </View>
  )
}