// uploadImage.js — Upload images to Firebase Storage, return download URLs
// Uses expo-file-system to read local file URIs (fixes Android issue where
// fetch() doesn't support file:// URIs)

import * as FileSystem from 'expo-file-system'
import { getDownloadURL, ref, uploadString } from 'firebase/storage'
import { storage } from '../firebase/config'

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
  // Read the file as base64 — this works reliably on Android where fetch(file://) fails
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  })

  const storageRef = ref(storage, path)
  // Upload using base64 format string — no Blob needed
  await uploadString(storageRef, base64, 'base64', {
    contentType: 'image/jpeg',
  })
  return getDownloadURL(storageRef)
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

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    if (!asset || !asset.uri) continue

    // Only accept images under ~5MB to keep things reasonable
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      console.warn(`Skipped image ${i}: file too large (${(asset.fileSize / 1024 / 1024).toFixed(1)}MB)`)
      continue
    }

    try {
      const path = `orders/${orderId}/${timestamp}-${i}.jpg`
      const url = await uploadImage(asset.uri, path)
      urls.push(url)
    } catch (e) {
      console.error(`Image upload failed for asset ${i}:`, e)
      // Continue with remaining images — don't block the order on a bad upload
    }
  }

  return urls.length > 0 ? urls : null
}
