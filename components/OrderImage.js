// OrderImage.js — Reusable image component with error handling
// Shows a loading placeholder or error state if image fails to load
import { useEffect, useState } from 'react'
import { Image, Text, View } from 'react-native'

export default function OrderImage({ uri, style, resizeMode = 'cover' }) {
  const [loadError, setLoadError] = useState(false)

  // Reset error state whenever the URI changes — this is critical because:
  // 1. Firebase Storage download URLs can refresh
  // 2. Order data re-fetches from Firebase trigger re-renders with new URIs
  // 3. Without this, a stale loadError would persist across data refreshes
  useEffect(() => {
    setLoadError(false)
  }, [uri])

  if (!uri) {
    return (
      <View style={[style, { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: style?.width > 50 ? 20 : 14 }}>📷</Text>
      </View>
    )
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        setLoadError(true)
        console.warn('OrderImage failed to load:', uri?.substring(0, 80))
      }}
    />
  )
}
