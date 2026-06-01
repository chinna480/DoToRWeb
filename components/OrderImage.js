// OrderImage.js — Reusable image component with auto-retry on failure
// v5: Fixed style?.width check — StyleSheet.create() returns integer IDs,
//     not plain objects, so style?.width is always undefined when passed
//     from StyleSheet refs. Use a safe flat object resolver instead.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const MAX_AUTO_RETRIES = 3
const RETRY_DELAY_MS    = 3000

/**
 * Safely resolve the numeric `width` from a style prop.
 * StyleSheet.create() returns integer IDs, not plain objects.
 * StyleSheet.flatten() converts any style value (integer, object, array) to
 * a plain object so we can read .width reliably.
 */
function resolveWidth(style) {
  if (!style) return 0
  try {
    const flat = StyleSheet.flatten(style)
    return flat?.width ?? 0
  } catch {
    return 0
  }
}

export default function OrderImage({ uri, style, resizeMode = 'cover' }) {
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading]     = useState(true)
  const retryCount                 = useRef(0)
  const autoRetryTimer             = useRef(null)
  const mounted                    = useRef(true)

  // Reset all states whenever the URI changes — critical because:
  // 1. Firebase Storage download URLs can refresh
  // 2. Order data re-fetches from Firebase trigger re-renders with new URIs
  // 3. Without this, stale states would persist across data refreshes
  useEffect(() => {
    setLoadError(false)
    setLoading(true)
    retryCount.current = 0
    if (autoRetryTimer.current) {
      clearTimeout(autoRetryTimer.current)
      autoRetryTimer.current = null
    }
  }, [uri])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (autoRetryTimer.current) {
        clearTimeout(autoRetryTimer.current)
        autoRetryTimer.current = null
      }
    }
  }, [])

  const retry = useCallback(() => {
    if (!mounted.current) return
    setLoadError(false)
    setLoading(true)
    retryCount.current += 1
    console.log(`[OrderImage] Auto-retry ${retryCount.current}/${MAX_AUTO_RETRIES} for:`, uri?.substring(0, 80))
  }, [uri])

  // ── Auto-retry on failure ─────────────────────────────────────────────
  // Instead of requiring the user to tap, we auto-retry up to 3 times
  // with a 3-second delay between each attempt. This handles transient
  // network issues, Firebase Storage cold starts, etc.
  useEffect(() => {
    if (loadError && retryCount.current < MAX_AUTO_RETRIES) {
      autoRetryTimer.current = setTimeout(retry, RETRY_DELAY_MS)
    }
    return () => {
      if (autoRetryTimer.current) {
        clearTimeout(autoRetryTimer.current)
        autoRetryTimer.current = null
      }
    }
  }, [loadError, retry])

  // ── Resolve actual width from style (works with StyleSheet IDs too) ──
  const resolvedWidth = resolveWidth(style)
  const iconSize = resolvedWidth > 50 ? 20 : 14

  // Validate URI before rendering
  if (!uri || typeof uri !== 'string') {
    return (
      <View style={[style, { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: iconSize }}>📷</Text>
      </View>
    )
  }

  // Error state — still show tap-to-retry as a fallback, but auto-retry is primary
  if (loadError && retryCount.current >= MAX_AUTO_RETRIES) {
    return (
      <TouchableOpacity
        onPress={() => {
          retryCount.current = 0  // reset retry counter on manual tap
          retry()
        }}
        style={[style, { backgroundColor: '#fff3e0', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ffcc80' }]}
      >
        <Text style={{ fontSize: iconSize }}>⚠️</Text>
        <Text style={{ fontSize: 8, color: '#e65100', marginTop: 2, fontWeight: '700' }}>Tap to retry</Text>
      </TouchableOpacity>
    )
  }

  // Append a cache-busting param only on retry (not first load)
  const imageUri = retryCount.current > 0
    ? `${uri}${uri.includes('?') ? '&' : '?'}_r=${retryCount.current}`
    : uri

  return (
    <View style={[style, { position: 'relative' }]}>
      {/* Loading spinner overlay */}
      {loading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', zIndex: 1 }}>
          <ActivityIndicator size="small" color="#FF6B00" />
        </View>
      )}
      <Image
        source={{ uri: imageUri }}
        style={style}
        resizeMode={resizeMode}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => {
          console.warn('[OrderImage] ❌ Failed to load:', uri?.substring(0, 100), 'error:', e?.nativeEvent?.error || 'unknown', `(retry ${retryCount.current}/${MAX_AUTO_RETRIES})`)
          setLoading(false)
          setLoadError(true)
        }}
      />
    </View>
  )
}