// components/ToastBanner.js
// ─────────────────────────────────────────────────────────────────────────────
// Animated in-app toast/banner that slides in from the top.
// Non-blocking — user can dismiss or tap to navigate.
// Auto-hides after 4 seconds.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
  View,
} from 'react-native'

const TOAST_DURATION = 4000 // ms before auto-dismiss
const ANIM_DURATION = 300   // ms for slide-in/out

/**
 * @param {object} props
 * @param {string|null} props.title - Notification title
 * @param {string|null} props.body - Notification body
 * @param {object|null} props.data - Notification data (contains screen, orderId, etc.)
 * @param {function} props.onDismiss - Called when toast is dismissed
 * @param {function} props.onNavigate - Called with (screen, data) when tapped
 */
export default function ToastBanner({ title, body, data, onDismiss, onNavigate }) {
  const [visible, setVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(-120)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(1)).current
  const timerRef = useRef(null)
  const dismissCalledRef = useRef(false)

  useEffect(() => {
    if (!title) return

    setVisible(true)
    dismissCalledRef.current = false
    slideAnim.setValue(-120)
    opacityAnim.setValue(0)
    progressAnim.setValue(1)

    // Slide in + fade in
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
    ]).start()

    // Progress bar shrinks from 100% → 0% over TOAST_DURATION
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: TOAST_DURATION,
      useNativeDriver: false,
    }).start()

    // Auto-dismiss timer
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      animateOut()
    }, TOAST_DURATION)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [title, body])

  const animateOut = () => {
    if (dismissCalledRef.current) return
    dismissCalledRef.current = true

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: ANIM_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false)
      if (onDismiss) onDismiss()
    })
  }

  const handlePress = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (onNavigate && data && data.screen) {
      onNavigate(data.screen, data)
    }
    animateOut()
  }

  if (!visible || !title) return null

  return (
    <Animated.View
      style={[
        s.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={s.touchable}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <View style={s.iconWrap}>
          <Text style={s.icon}>{title.charAt(0)}</Text>
        </View>
        <View style={s.content}>
          <Text style={s.title} numberOfLines={1}>
            {/* Strip the first emoji+space character from title for clean display */}
            {title.replace(/^[^\s]+\s/, '')}
          </Text>
          <Text style={s.body} numberOfLines={2}>
            {body}
          </Text>
        </View>
        <TouchableOpacity
          style={s.closeBtn}
          onPress={animateOut}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Text style={s.closeTxt}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
      {/* Shrinking progress bar showing remaining time */}
      <View style={s.progressBar}>
        <Animated.View
          style={[
            s.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
    borderRadius: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingRight: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A3A6B',
  },
  body: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#999',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#f0f0f0',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#FF6B00',
    borderRadius: 2,
  },
})
