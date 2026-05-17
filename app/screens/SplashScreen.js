import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Animated, Image, StyleSheet, Text, View } from 'react-native'

export default function SplashScreen() {
  const router = useRouter()
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 3000, useNativeDriver: false }).start()
    const t = setTimeout(() => router.replace('/screens/RoleScreen'), 3000)
    return () => clearTimeout(t)
  }, [])

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  return (
    <View style={s.container}>
      <Image source={require('../../assets/images/logo.png')} style={s.logo} resizeMode="contain" />
      <Text style={s.caption}>We are the Doctor of your Device</Text>
      <View style={s.loaderBg}>
        <Animated.View style={[s.loaderBar, { width: barWidth }]} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  logo:      { width: 220, height: 220 },
  caption:   { fontSize: 16, fontWeight: '700', color: '#1A3A6B', marginTop: 15, textAlign: 'center', paddingHorizontal: 30 },
  loaderBg:  { width: 60, height: 4, backgroundColor: '#eee', borderRadius: 4, marginTop: 40, overflow: 'hidden' },
  loaderBar: { height: '100%', backgroundColor: '#FF6B00', borderRadius: 4 },
})