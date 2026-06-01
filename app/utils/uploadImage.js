// uploadImage.js — Upload images to Firebase Storage, return download URLs
// Eliminates base64 from the app entirely, preventing OOM crashes on Android

import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../firebase/config'

/**
 * Upload an image URI (file:// or content://) to Firebase Storage.
 * Returns the HTTPS download URL.
 *
 * @param {string} uri  Local file URI from expo-image-picker
 * @param {string} path Storage path (e.g. 'orders/abc123/image-0.jpg')
 * @returns {Promise<string>} Download URL
 */
export async function uploadImage(uri, path) {
  const response = await fetch(uri)
  const blob = await response.blob()
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob)
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
