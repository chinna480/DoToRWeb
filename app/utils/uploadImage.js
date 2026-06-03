// uploadImage.js — Cloudinary image upload (no Firebase Storage needed)

import * as FileSystem from 'expo-file-system'

// ── Cloudinary credentials (hardcoded — cloud name is not a secret) ──────
const CLOUDINARY_CLOUD_NAME    = 'dxyp1sblk'
const CLOUDINARY_UPLOAD_PRESET = 'dotor_orders'
// ─────────────────────────────────────────────────────────────────────────

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`
const MAX_RETRIES    = 3
const MAX_FILE_SIZE  = 5 * 1024 * 1024 // 5 MB

export async function uploadImage(uri, folder) {
  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`📤 Cloudinary upload attempt ${attempt}/${MAX_RETRIES}`)
      console.log(`   URL: ${CLOUDINARY_URL}`)
      console.log(`   Preset: ${CLOUDINARY_UPLOAD_PRESET}`)
      console.log(`   Folder: ${folder}`)

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      if (!base64 || base64.length < 100) {
        throw new Error(`File read failed — base64 too short (${base64?.length || 0} chars)`)
      }

      console.log(`   ✅ File read: ${(base64.length / 1024).toFixed(1)} KB`)

      const lower    = uri.toLowerCase()
      const mimeType = lower.endsWith('.png')  ? 'image/png'
                     : lower.endsWith('.webp') ? 'image/webp'
                     : 'image/jpeg'

      const dataUri = `data:${mimeType};base64,${base64}`

      const formData = new FormData()
      formData.append('file', dataUri)
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
      formData.append('folder', folder)

      console.log(`   📡 Sending to Cloudinary...`)

      const response = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: formData,
      })

      const responseText = await response.text()
      console.log(`   📡 Response status: ${response.status}`)
      console.log(`   📡 Response body: ${responseText.substring(0, 300)}`)

      if (!response.ok) {
        throw new Error(`Cloudinary ${response.status}: ${responseText}`)
      }

      const data = JSON.parse(responseText)

      if (!data.secure_url) {
        throw new Error(`No secure_url in response: ${responseText}`)
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

    let fileSize = asset.fileSize || 0
    if (!fileSize) {
      try {
        const info = await FileSystem.getInfoAsync(asset.uri, { size: true })
        fileSize = info.size || 0
      } catch (_) {}
    }

    if (fileSize > MAX_FILE_SIZE) {
      const mb = (fileSize / 1024 / 1024).toFixed(1)
      errors.push(`Image ${i}: too large (${mb} MB)`)
      console.warn(`   ⚠️ Image ${i}: skipped — ${mb} MB > 5 MB`)
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