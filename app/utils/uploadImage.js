// uploadImage.js — Upload images to Firebase Storage, return download URLs
// Uses expo-file-system to read local file URIs (fixes Android issue where
// fetch() doesn't support file:// URIs)

import * as FileSystem from 'expo-file-system'
import { getDownloadURL, ref, uploadString } from 'firebase/storage'
import { storage } from '../firebase/config'

const MAX_RETRIES = 3

/**
 * Upload a single image to Firebase Storage.
 * Returns the HTTPS download URL.
 */
export async function uploadImage(uri, path) {
  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`📤 Uploading image (attempt ${attempt}/${MAX_RETRIES}): ${path}`)
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      if (!base64 || base64.length < 100) {
        throw new Error(`Base64 data too short (${base64?.length || 0} chars)`)
      }

      console.log(`  ✅ Read file: ${(base64.length / 1024).toFixed(1)} KB`)
      const storageRef = ref(storage, path)
      await uploadString(storageRef, base64, 'base64', {
        contentType: 'image/jpeg',
      })

      console.log(`  ✅ Uploaded to Firebase Storage`)
      const downloadUrl = await getDownloadURL(storageRef)
      console.log(`  ✅ Got download URL`)
      return downloadUrl
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
 * Upload multiple images to Firebase Storage.
 * Returns an array of download URLs (or null if none succeed).
 */
export async function uploadImages(assets, orderId) {
  if (!assets || assets.length === 0) return null

  const timestamp = Date.now()
  const urls = []
  const errors = []

  console.log(`📸 Uploading ${assets.length} image(s) for order ${orderId}`)

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    if (!asset || !asset.uri) {
      console.warn(`  ⚠️ Image ${i}: skipped (no URI)`)
      continue
    }

    // Skip files over ~5MB
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      errors.push(`Image ${i}: file too large (${(asset.fileSize / 1024 / 1024).toFixed(1)} MB)`)
      console.warn(`  ⚠️ Image ${i}: skipped (${(asset.fileSize / 1024 / 1024).toFixed(1)} MB > 5 MB limit)`)
      continue
    }

    try {
      const path = `orders/${orderId}/${timestamp}-${i}.jpg`
      console.log(`  📤 Image ${i}: uri=${asset.uri.substring(0, 80)}...`)
      const url = await uploadImage(asset.uri, path)
      urls.push(url)
      console.log(`  ✅ Image ${i}: uploaded successfully`)
    } catch (e) {
      errors.push(`Image ${i} upload failed: ${e.message || e}`)
      console.error(`  ❌ Image ${i}: failed -`, e.message || e)
    }
  }

  if (errors.length > 0) {
    console.error(`📸 Upload summary: ${urls.length}/${assets.length} succeeded, errors:`, errors)
  } else if (urls.length > 0) {
    console.log(`📸 Upload summary: ${urls.length}/${assets.length} succeeded`)
  } else {
    console.error(`📸 Upload summary: ALL ${assets.length} image(s) FAILED`)
  }

  return urls.length > 0 ? urls : null
}
