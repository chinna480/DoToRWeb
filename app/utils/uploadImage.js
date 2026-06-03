// uploadImage.js — Upload images to Cloudinary (free, no credit card)
// Replaces Firebase Storage entirely.
// Free tier: 25 GB storage + 25 GB bandwidth/month
//
// SETUP (one-time):
//  1. Sign up free at https://cloudinary.com
//  2. Settings → Upload → Upload Presets → Add upload preset
//  3. Set Signing Mode to "Unsigned" → Save
//  4. Fill in CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET below

import * as FileSystem from 'expo-file-system'

// ── CLOUDINARY CREDENTIALS (from .env file) ────────────────────────────
// Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET
// in your project root .env file (already listed in .gitignore).
// Expo automatically inlines EXPO_PUBLIC_* vars at build time.
const CLOUDINARY_CLOUD_NAME    = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME    || 'dxyp1sblk'
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'dotor_orders'
if (!process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || !process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET) {
  console.warn('⚠️ Cloudinary credentials not found in .env — using fallback hardcoded values.')
  console.warn('   Create a .env file in the project root with:')
  console.warn('   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name')
  console.warn('   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset')
}
// ────────────────────────────────────────────────────────────────────────

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`
const MAX_RETRIES    = 3
const MAX_FILE_SIZE  = 5 * 1024 * 1024 // 5 MB

/**
 * Upload a single image to Cloudinary.
 * Returns the secure HTTPS URL of the uploaded image.
 */
export async function uploadImage(uri, folder) {
  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`📤 Uploading to Cloudinary (attempt ${attempt}/${MAX_RETRIES})`)

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      if (!base64 || base64.length < 100) {
        throw new Error(`File read failed — base64 too short (${base64?.length || 0} chars)`)
      }

      console.log(`  ✅ Read file: ${(base64.length / 1024).toFixed(1)} KB`)

      const lower    = uri.toLowerCase()
      const mimeType = lower.endsWith('.png')  ? 'image/png'
                     : lower.endsWith('.webp') ? 'image/webp'
                     : 'image/jpeg'

      const dataUri  = `data:${mimeType};base64,${base64}`

      const formData = new FormData()
      formData.append('file', dataUri)
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
      formData.append('folder', folder)

      const response = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Cloudinary ${response.status}: ${errText}`)
      }

      const data = await response.json()
      if (!data.secure_url) {
        throw new Error(`No secure_url in response: ${JSON.stringify(data)}`)
      }

      console.log(`  ✅ Uploaded: ${data.secure_url.substring(0, 60)}...`)
      return data.secure_url

    } catch (e) {
      lastError = e
      console.error(`  ❌ Attempt ${attempt} failed:`, e.message || e)
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, attempt * 1000))
      }
    }
  }

  throw lastError
}

/**
 * Upload multiple images to Cloudinary.
 * Returns array of secure URLs, or null if all fail.
 */
export async function uploadImages(assets, orderId) {
  if (!assets || assets.length === 0) return null

  const folder = `orders/${orderId}`
  const urls   = []
  const errors = []

  console.log(`📸 Uploading ${assets.length} image(s) → Cloudinary folder: ${folder}`)

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    if (!asset?.uri) {
      console.warn(`  ⚠️ Image ${i}: skipped (no URI)`)
      continue
    }

    // File size — use FileSystem as fallback (Android often omits fileSize)
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
      console.warn(`  ⚠️ Image ${i}: skipped — ${mb} MB > 5 MB limit`)
      continue
    }

    try {
      const url = await uploadImage(asset.uri, folder)
      urls.push(url)
      console.log(`  ✅ Image ${i}: success`)
    } catch (e) {
      errors.push(`Image ${i}: ${e.message || e}`)
      console.error(`  ❌ Image ${i}: failed —`, e.message || e)
    }
  }

  if (urls.length === 0) {
    console.error(`📸 ALL ${assets.length} upload(s) FAILED:`, errors)
  } else if (errors.length > 0) {
    console.warn(`📸 ${urls.length}/${assets.length} succeeded. Errors:`, errors)
  } else {
    console.log(`📸 All ${urls.length} uploaded successfully ✅`)
  }

  return urls.length > 0 ? urls : null
}