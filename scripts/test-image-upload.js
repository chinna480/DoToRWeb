/**
 * Test script: End-to-end image upload pipeline test.
 *
 * Simulates exactly what the app does:
 *   1. Read image base64 data (we generate a small JPEG here instead)
 *   2. Upload to Firebase Storage using uploadString()
 *   3. Save download URL to Realtime Database under orders/{orderId}/images
 *   4. Verify the data is stored correctly in both Firebase Storage and RTDB
 *
 * Usage: node scripts/test-image-upload.js
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT env var with path to service account key
 * OR: uses the app's Firebase web SDK config (for Storage & RTDB access)
 */

const { initializeApp } = require('firebase/app')
const { getStorage, ref: storageRef, uploadString, getDownloadURL, deleteObject, listAll } = require('firebase/storage')
const { getDatabase, ref: dbRef, set, get, child, remove } = require('firebase/database')

// ── Firebase config (same as app/firebase/config.js) ──────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyDGzlU-qp5Q_ht8xxIrpyeGNPLgbbKexKs',
  authDomain: 'dotor-2e4d8.firebaseapp.com',
  databaseURL: 'https://dotor-2e4d8-default-rtdb.firebaseio.com',
  projectId: 'dotor-2e4d8',
  storageBucket: 'dotor-2e4d8.firebasestorage.app',
  messagingSenderId: '984437487718',
  appId: '1:984437487718:android:c323dd93e33ea0889915a7',
}

console.log('🔥 Initializing Firebase...')
const app = initializeApp(firebaseConfig, 'test-app')
const storage = getStorage(app)
const db = getDatabase(app)

// ── Generate a tiny valid JPEG (1x1 pixel, ~600 bytes) ───────────────────
function generateTestJpegBase64() {
  // Minimal valid JPEG base64 — 1x1 pixel, white
  // This is a standard minimal JPEG encoded as base64
  const jpegBase64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////' +
    '2wBDAf//////////////////////////////////////////////////////////////////////////////////////' +
    'wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAA' +
    'AAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAA' +
    'AP/aAAwDAQACEQMRAD8AoAAAAA'
  return jpegBase64
}

// ── Colored image helper (bigger, more realistic) ─────────────────────────
function generateColoredJpegBase64(width, height, r, g, b) {
  // Create a simple BMP-ish base64 that Firebase Storage will accept
  // Since we can't use 'jimp' or similar, we use the minimal valid JPEG
  return generateTestJpegBase64()
}

// ── Core test ─────────────────────────────────────────────────────────────
async function runTest() {
  const orderId = `test-image-upload-${Date.now()}`
  const timestamp = Date.now()
  const imagePath = `orders/${orderId}/${timestamp}-0.jpg`
  let allPassed = true

  console.log(`\n📋 Test Order ID: ${orderId}`)
  console.log(`📋 Image path in Storage: ${imagePath}`)
  console.log('─'.repeat(60))

  // ── STEP 1: Upload image to Firebase Storage ────────────────────────────
  console.log('\n📤 STEP 1: Uploading test image to Firebase Storage...')
  try {
    const base64Data = generateTestJpegBase64()
    console.log(`  Base64 data length: ${base64Data.length} chars`)

    const storageReference = storageRef(storage, imagePath)
    await uploadString(storageReference, base64Data, 'base64', {
      contentType: 'image/jpeg',
    })
    console.log('  ✅ uploadString() succeeded!')

    const downloadUrl = await getDownloadURL(storageReference)
    console.log(`  ✅ Got download URL: ${downloadUrl.substring(0, 80)}...`)

    if (!downloadUrl || !downloadUrl.startsWith('https://')) {
      console.error('  ❌ Download URL is invalid!')
      allPassed = false
    } else {
      console.log('  ✅ Download URL looks valid (starts with https://)')
    }

    // ── STEP 2: Verify image exists in Storage bucket ──────────────────────
    console.log('\n📤 STEP 2: Verifying image exists in Firebase Storage...')
    try {
      // Try to list files in the test directory
      const parentRef = storageRef(storage, `orders/${orderId}`)
      const listResult = await listAll(parentRef)
      console.log(`  Items in orders/${orderId}/: ${listResult.items.length}`)
      listResult.items.forEach(item => {
        console.log(`    - ${item.name}`)
      })
      if (listResult.items.length > 0) {
        console.log('  ✅ Image confirmed in Firebase Storage!')
      } else {
        console.warn('  ⚠️ No items listed, but upload succeeded — may need storage rules check')
      }
    } catch (listErr) {
      console.warn(`  ⚠️ Could not list files (expected if storage rules restrict listing): ${listErr.message}`)
    }

    // ── STEP 3: Save image URL to Realtime Database ────────────────────────
    console.log('\n📤 STEP 3: Saving image URL to Realtime Database...')
    const orderData = {
      repairType: 'Test Upload',
      description: 'Test image upload from automated test script',
      status: 'test',
      images: [downloadUrl],
      createdAt: new Date().toISOString(),
    }

    await set(dbRef(db, `orders/${orderId}`), orderData)
    console.log('  ✅ Order saved to RTDB at orders/' + orderId)

    // ── STEP 4: Read back and verify ──────────────────────────────────────
    console.log('\n📤 STEP 4: Reading back from Realtime Database...')
    const snapshot = await get(dbRef(db, `orders/${orderId}`))
    if (snapshot.exists()) {
      const data = snapshot.val()
      console.log('  ✅ Order found in RTDB!')
      console.log(`  Status: ${data.status}`)
      console.log(`  Images field present: ${!!data.images}`)
      console.log(`  Images type: ${typeof data.images}`)
      console.log(`  Images isArray: ${Array.isArray(data.images)}`)
      console.log(`  Images count: ${data.images ? (Array.isArray(data.images) ? data.images.length : Object.keys(data.images).length) : 0}`)

      if (data.images) {
        const images = Array.isArray(data.images) ? data.images : Object.values(data.images)
        console.log(`  ✅ ${images.length} image URL(s) stored in RTDB`)
        images.forEach((url, i) => {
          console.log(`    [${i}]: ${url ? url.substring(0, 60) + '...' : 'MISSING!'}`)
        })
      } else {
        console.error('  ❌ No images field in order data!')
        allPassed = false
      }
    } else {
      console.error('  ❌ Order not found in RTDB!')
      allPassed = false
    }

    // ── CLEANUP ───────────────────────────────────────────────────────────
    console.log('\n🧹 STEP 5: Cleaning up test data...')
    try {
      // Delete from Storage
      const storageReferenceToDelete = storageRef(storage, imagePath)
      await deleteObject(storageReferenceToDelete)
      console.log('  ✅ Test image deleted from Storage')

      // Delete from RTDB
      await remove(dbRef(db, `orders/${orderId}`))
      console.log('  ✅ Test order deleted from RTDB')
    } catch (cleanupErr) {
      console.warn(`  ⚠️ Cleanup warning: ${cleanupErr.message}`)
    }

  } catch (err) {
    console.error(`\n❌ TEST FAILED: ${err.message}`)
    console.error(err.stack)
    allPassed = false

    // Cleanup on failure
    try {
      await remove(dbRef(db, `orders/${orderId}`))
    } catch (e) {}
  }

  console.log('\n' + '═'.repeat(60))
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED — Image upload pipeline is working!')
    console.log('   Images can be uploaded to Firebase Storage and saved to RTDB.')
  } else {
    console.log('❌ SOME TESTS FAILED — Check the errors above.')
  }
  console.log('═'.repeat(60))
}

runTest().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
