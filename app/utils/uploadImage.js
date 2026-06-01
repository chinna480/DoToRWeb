// uploadImage.js — Upload images to Firebase Storage, return download URLs
// Uses expo-file-system to read local file URIs (fixes Android issue where
// fetch() doesn't support file:// URIs)

import * as FileSystem from 'expo-file-system'
import { getDownloadURL, ref, uploadString } from 'firebase/storage'
import { storage } from '../firebase/config'

const MAX_RETRIES = 3

/**
 * Upload an image URI (file:// or content://) to Firebase Storage.
 * Returns the HTTPS download URL.
 *
 * Uses expo-file-system to read the file as base64 (works on all platforms)
 * then uploads via Firebase Storage's uploadString.
 *
 * @param {string} uri  Local file URI from expo-image-picker
 * @param {string} path Storage path (e.g. 'orders/abc123/image-0.jpg')
 * @returns {Promise<string>} Download URL
 */
export async function uploadImage(uri, path) {
  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Read the file as base64 — this works reliably on Android where fetch(file://) fails
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      if (!base64 || base64.length < 100) {
        throw new Error(`Base64 data too short (${base64?.length || 0} chars) — file may be empty or corrupted`)
      }

      console.log(`[uploadImage] Attempt ${attempt}/${MAX_RETRIES} — path: ${path}, base64 size: ${(base64.length / 1024).toFixed(0)}KB`)

      const storageRef = ref(storage, path)
      // Upload using base64 format string — no Blob needed
      await uploadString(storageRef, base64, 'base64', {
        contentType: 'image/jpeg',
      })

      const downloadUrl = await getDownloadURL(storageRef)
      console.log(`[uploadImage] ✅ Success — URL length: ${downloadUrl.length}`)
      return downloadUrl
    } catch (e) {
      lastError = e
      console.warn(`[uploadImage] ❌ Attempt ${attempt}/${MAX_RETRIES} failed:`, e.message || e)
      if (attempt < MAX_RETRIES) {
        // Wait before retrying (1s, 2s, 3s...)
        await new Promise(r => setTimeout(r, attempt * 1000))
      }
    }
  }

  // All retries failed
  console.error(`[uploadImage] All ${MAX_RETRIES} attempts failed for ${path}:`, lastError?.message)
  throw lastError
}

/**
 * Upload multiple images to Firebase Storage.
 * Returns an array of download URLs (or null if none succeed).
 *
 * @param {Array<{uri:string}>} assets  Image assets from expo-image-picker
 * @param {string}              orderId Unique order identifier for the storage path
 * @returns {Promise<string[]|null>}
 */
export async function uploadImages(assets, orderId) {
  if (!assets || assets.length === 0) return null

  const timestamp = Date.now()
  const urls = []
  const errors = []

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    if (!asset || !asset.uri) continue

    // Only accept images under ~5MB to keep things reasonable
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      const msg = `Skipped image ${i}: file too large (${(asset.fileSize / 1024 / 1024).toFixed(1)}MB)`
      console.warn(`[uploadImages] ${msg}`)
      errors.push(msg)
      continue
    }

    try {
      const path = `orders/${orderId}/${timestamp}-${i}.jpg`
      const url = await uploadImage(asset.uri, path)
      urls.push(url)
    } catch (e) {
      const msg = `Image ${i} upload failed after retries: ${e.message || e}`
      console.error(`[uploadImages] ${msg}`)
      errors.push(msg)
      // Continue with remaining images — don't block the order on a bad upload
    }
  }

  console.log(`[uploadImages] Result: ${urls.length}/${assets.length} uploaded successfully${errors.length ? ` (${errors.length} failed)` : ''}`)

  return urls.length > 0 ? urls : null
}
