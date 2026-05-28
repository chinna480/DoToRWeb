import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Animated, Easing, StatusBar, StyleSheet, Text, View } from 'react-native'
import LiquidGlassLogo from '../../components/LiquidGlassLogo'

export default function SplashScreen() {
  const router = useRouter()
  const progress = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const taglineFade = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(taglineFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(progress, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]).start()

    const t = setTimeout(() => router.replace('/screens/RoleScreen'), 3000)
    return () => clearTimeout(t)
  }, [])

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  const fadeOut = {
    opacity: progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
  }

  return (
    <Animated.View style={[s.container, fadeOut]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <Animated.View style={{ opacity: fadeAnim }}>
        <LiquidGlassLogo />
      </Animated.View>
      <Animated.Text style={[s.caption, { opacity: taglineFade }]}>We are the Doctor of your Device</Animated.Text>
      <View style={s.loaderBg}>
        <Animated.View style={[s.loaderBar, { width: barWidth }]} />
      </View>
      <Animated.Text style={[s.footer, { opacity: taglineFade }]}>Door-to-Door Repair Service</Animated.Text>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 30 },
  caption: { fontSize: 16, fontWeight: '700', color: '#1A3A6B', marginTop: 25, textAlign: 'center', paddingHorizontal: 30, lineHeight: 22 },
  loaderBg: { width: 80, height: 4, backgroundColor: '#eee', borderRadius: 4, marginTop: 40, overflow: 'hidden' },
  loaderBar: { height: '100%', backgroundColor: '#FF6B00', borderRadius: 4 },
  footer: { fontSize: 12, color: '#aaa', fontWeight: '600', marginTop: 20, letterSpacing: 1 },
})
