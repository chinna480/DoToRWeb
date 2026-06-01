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
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      if (!base64 || base64.length < 100) {
        throw new Error(`Base64 data too short (${base64?.length || 0} chars)`)
      }

      const storageRef = ref(storage, path)
      await uploadString(storageRef, base64, 'base64', {
        contentType: 'image/jpeg',
      })

      const downloadUrl = await getDownloadURL(storageRef)
      return downloadUrl
    } catch (e) {
      lastError = e
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

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    if (!asset || !asset.uri) continue

    // Skip files over ~5MB
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      errors.push(`Image ${i}: file too large`)
      continue
    }

    try {
      const path = `orders/${orderId}/${timestamp}-${i}.jpg`
      const url = await uploadImage(asset.uri, path)
      urls.push(url)
    } catch (e) {
      errors.push(`Image ${i} upload failed: ${e.message || e}`)
    }
  }

  return urls.length > 0 ? urls : null
}
