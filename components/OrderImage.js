// OrderImage.js — Reusable image component with error handling
// Shows a loading placeholder or error state if image fails to load
import { useState } from 'react'
import { Image, Text, View } from 'react-native'

export default function OrderImage({ uri, style, resizeMode = 'cover' }) {
  const [loadError, setLoadError] = useState(false)

  if (loadError || !uri) {
    return (
      <View style={[style, { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: style.width > 50 ? 20 : 14 }}>📷</Text>
      </View>
    )
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setLoadError(true)}
    />
  )
}
