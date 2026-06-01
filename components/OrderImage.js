// OrderImage.js — Reusable image component with auto-retry on failure
// v4: Auto-retries when the image fails to load (no manual tap required)
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native'

const MAX_AUTO_RETRIES = 3
const RETRY_DELAY_MS    = 3000

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

  // Validate URI before rendering
  if (!uri || typeof uri !== 'string') {
    return (
      <View style={[style, { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: style?.width > 50 ? 20 : 14 }}>📷</Text>
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
        <Text style={{ fontSize: style?.width > 50 ? 18 : 12 }}>⚠️</Text>
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
