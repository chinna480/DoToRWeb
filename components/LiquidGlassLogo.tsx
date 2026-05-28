import { useEffect, useRef } from 'react'
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const LOGO_SIZE = SCREEN_WIDTH * 0.45

const GRADIENT_COLORS: readonly [string, string, ...string[]] = [
  '#FF6B00',
  '#FF8C38',
  '#1A3A6B',
  '#2D5F9E',
  '#FF6B00',
]

export default function LiquidGlassLogo({ size = LOGO_SIZE }) {
  // ── Animated values ──
  const rotateAnim = useRef(new Animated.Value(0)).current
  const shineAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Slow rotation of the gradient — creates liquid flow effect
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start()

    // Shine glint sweep (combined into one sequence for performance)
    Animated.loop(
      Animated.sequence([
        Animated.timing(shineAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shineAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start()

    // Gentle pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  const rotateDeg = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const shineOpacity = shineAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.25, 0],
  })

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2.5,
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      {/* ── Layer 1: Rotating Liquid Gradient ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: size / 2.5,
            transform: [{ rotate: rotateDeg }],
          },
        ]}
      >
        <LinearGradient
          colors={GRADIENT_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: size / 2.5 },
          ]}
        />
      </Animated.View>

      {/* ── Layer 2: Glass morphism overlay ── */}
      <BlurView
        intensity={35}
        tint="light"
        style={[
          styles.glassOverlay,
          { borderRadius: size / 2.5 },
        ]}
      >
        {/* Shine streak */}
        <Animated.View
          style={[
            styles.shineStreak,
            { opacity: shineOpacity },
          ]}
        />

        {/* Content inside the glass */}
        <View style={styles.content}>
          <Text style={[styles.wrenchIcon, { fontSize: size * 0.22 }]}>
            🔧
          </Text>
          <Text style={[styles.brandText, { fontSize: size * 0.12 }]}>
            DoToR
          </Text>
          <Text style={[styles.subtitle, { fontSize: size * 0.045 }]}>
            Device Doctor
          </Text>
        </View>
      </BlurView>

      {/* ── Layer 3: Outer glass border ── */}
      <View
        style={[
          styles.glassBorder,
          { borderRadius: size / 2.5 },
        ]}
        pointerEvents="none"
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },

  // Glass morphism overlay
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Shine streak
  shineStreak: {
    position: 'absolute',
    top: '-10%',
    left: '-10%',
    right: '-10%',
    height: '35%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    transform: [{ skewY: '-8deg' }],
  },

  // Content centered inside the glass
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },

  wrenchIcon: {
    marginBottom: 2,
  },

  brandText: {
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  subtitle: {
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  // Outer glass border / reflection edge
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
})
