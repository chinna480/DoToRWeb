// uploadImage.js — Cloudinary image upload via native multipart (no base64)
// Fix: Uses React Native's native file upload instead of base64 + data URI.
// Reading entire images as base64 caused memory issues and FormData failures
// when uploading multiple files — only the first image would succeed.

import * as FileSystem from 'expo-file-system'

// ── Cloudinary credentials (from .env via EXPO_PUBLIC_ prefix) ──────────
const CLOUDINARY_CLOUD_NAME    = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dxyp1sblk'
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'dotor_orders'
// ─────────────────────────────────────────────────────────────────────────

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`
const MAX_RETRIES    = 3
const MAX_FILE_SIZE  = 5 * 1024 * 1024 // 5 MB

/**
 * Upload a single image to Cloudinary using React Native's native file upload.
 * Instead of reading the entire file as base64, this passes the file URI
 * with type/name metadata so the native networking layer streams it directly.
 */
export async function uploadImage(uri, folder) {
  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`📤 Cloudinary upload attempt ${attempt}/${MAX_RETRIES}`)
      console.log(`   Folder: ${folder}`)

      // Check file size before uploading
      let fileSize = 0
      try {
        const info = await FileSystem.getInfoAsync(uri, { size: true })
        fileSize = info.size || 0
      } catch (_) {}

      if (fileSize > MAX_FILE_SIZE) {
        throw new Error(`File too large (${(fileSize / 1024 / 1024).toFixed(1)} MB > 5 MB)`)
      }

      // Determine mime type from extension
      const lower    = uri.toLowerCase()
      const mimeType = lower.endsWith('.png')  ? 'image/png'
                     : lower.endsWith('.webp') ? 'image/webp'
                     : 'image/jpeg'

      // ⭐ Use React Native native file upload — NOT base64 data URI.
      // React Native's FormData handles { uri, type, name } objects natively,
      // streaming the file directly without loading it all into memory.
      const formData = new FormData()
      formData.append('file', {
        uri,
        type: mimeType,
        name: `photo_${Date.now()}.${mimeType.split('/')[1]}`,
      })
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
      formData.append('folder', folder)

      console.log(`   📡 Sending to Cloudinary (native file upload)...`)

      const response = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: formData,
        // ⚠️ No Content-Type header — React Native sets it automatically
        // with the correct boundary when body is FormData.
      })

      const responseText = await response.text()
      console.log(`   📡 Response status: ${response.status}`)

      if (!response.ok) {
        throw new Error(`Cloudinary ${response.status}: ${responseText.substring(0, 200)}`)
      }

      const data = JSON.parse(responseText)

      if (!data.secure_url) {
        throw new Error(`No secure_url in response`)
      }

      console.log(`   ✅ Upload success: ${data.secure_url.substring(0, 80)}`)
      return data.secure_url

    } catch (e) {
      lastError = e
      console.error(`   ❌ Attempt ${attempt} failed: ${e.message || e}`)
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, attempt * 1000))
      }
    }
  }

  throw lastError
}

/**
 * Upload multiple images sequentially. Each image is uploaded independently
 * so a single failure doesn't block the rest. Returns array of URLs or null.
 */
export async function uploadImages(assets, orderId) {
  if (!assets || assets.length === 0) return null

  const folder = `orders/${orderId}`
  const urls   = []
  const errors = []

  console.log(`📸 Uploading ${assets.length} image(s) → folder: ${folder}`)

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    if (!asset?.uri) {
      console.warn(`   ⚠️ Image ${i}: skipped (no URI)`)
      continue
    }

    try {
      const url = await uploadImage(asset.uri, folder)
      urls.push(url)
      console.log(`   ✅ Image ${i}: done`)
    } catch (e) {
      errors.push(`Image ${i}: ${e.message || e}`)
      console.error(`   ❌ Image ${i}: failed — ${e.message || e}`)
    }
  }

  if (urls.length === 0) {
    console.error(`📸 ALL ${assets.length} upload(s) FAILED:`, errors)
  } else {
    console.log(`📸 ${urls.length}/${assets.length} uploaded ✅`)
  }

  return urls.length > 0 ? urls : null
}