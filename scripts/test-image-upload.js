/**
 * Test script: End-to-end image upload pipeline test (Cloudinary).
 *
 * Simulates what the app does:
 *   1. Generate a test image (small PNG)
 *   2. Upload to Cloudinary via fetch + FormData
 *   3. Save the returned URL to Realtime Database under orders/{orderId}/images
 *   4. Verify the data is stored correctly in RTDB
 *   5. Clean up
 *
 * Usage: node scripts/test-image-upload.js
 *
 * Requires:
 *   - Node.js 18+ (for built-in fetch + FormData)
 *   - A Cloudinary unsigned upload preset configured
 *     (see app/utils/uploadImage.js for instructions)
 */

const { initializeApp } = require('firebase/app')
const { getDatabase, ref: dbRef, set, get, child, remove } = require('firebase/database')

// ── Cloudinary credentials (from .env file) ──────────────────────────────
// For Node.js scripts, .env is NOT auto-loaded. Either:
//   a) Set env vars in your shell, or
//   b) Run with: node --env-file=.env scripts/test-image-upload.js
//
// Falls back to hardcoded values (with warning) for convenience.
const CLOUDINARY_CLOUD_NAME    = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME    || 'dxyp1sblk'
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'dotor_orders'
const CLOUDINARY_URL           = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`
if (!process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || !process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET) {
  console.warn('⚠️ Cloudinary credentials not found in env — using fallback hardcoded values.')
  console.warn('   Run with: node --env-file=.env scripts/test-image-upload.js')
}
// ────────────────────────────────────────────────────────────────────────

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
const db = getDatabase(app)

// ── Generate a tiny valid PNG (1x1 pixel, white) ─────────────────────────
function generateTestPngBase64() {
  // Minimal valid 1x1 white PNG
  // PNG format: signature + IHDR + IDAT + IEND
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ' +
    '/PchF7QAAAABJRU5ErkJggg=='
  return pngBase64
}

// ── Upload to Cloudinary ──────────────────────────────────────────────────
async function uploadToCloudinary(base64Data, folder) {
  const dataUri = `data:image/png;base64,${base64Data}`

  const formData = new FormData()
  formData.append('file', dataUri)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  formData.append('folder', folder)

  console.log(`  Uploading to Cloudinary folder: ${folder}`)

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
  console.log(`  Public ID: ${data.public_id}`)
  return data.secure_url
}

// ── Core test ─────────────────────────────────────────────────────────────
async function runTest() {
  const orderId = `test-image-upload-${Date.now()}`
  const folder  = `orders/${orderId}`
  let allPassed = true

  console.log(`\n📋 Test Order ID: ${orderId}`)
  console.log(`📋 Cloudinary folder: ${folder}`)
  console.log('─'.repeat(60))

  // ── STEP 1: Upload image to Cloudinary ──────────────────────────────────
  console.log('\n📤 STEP 1: Uploading test image to Cloudinary...')
  let downloadUrl
  try {
    const base64Data = generateTestPngBase64()
    console.log(`  Base64 data length: ${base64Data.length} chars`)

    downloadUrl = await uploadToCloudinary(base64Data, folder)

    if (!downloadUrl || !downloadUrl.startsWith('https://')) {
      console.error('  ❌ Download URL is invalid!')
      allPassed = false
    } else {
      console.log('  ✅ Download URL looks valid (starts with https://)')
    }
  } catch (err) {
    console.error(`\n❌ STEP 1 FAILED: ${err.message}`)
    console.error(err.stack)
    allPassed = false
    // Cannot proceed without a URL
    console.log('\n' + '═'.repeat(60))
    console.log(allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED')
    console.log('═'.repeat(60))
    return
  }

  // ── STEP 2: Save image URL to Realtime Database ────────────────────────
  console.log('\n📤 STEP 2: Saving image URL to Realtime Database...')
  try {
    const orderData = {
      repairType: 'Test Upload (Cloudinary)',
      description: 'Test image upload via Cloudinary from automated test script',
      status: 'test',
      images: [downloadUrl],
      createdAt: new Date().toISOString(),
    }

    await set(dbRef(db, `orders/${orderId}`), orderData)
    console.log('  ✅ Order saved to RTDB at orders/' + orderId)
  } catch (err) {
    console.error(`\n❌ STEP 2 FAILED: ${err.message}`)
    allPassed = false
  }

  // ── STEP 3: Read back and verify ────────────────────────────────────────
  console.log('\n📤 STEP 3: Reading back from Realtime Database...')
  try {
    const snapshot = await get(dbRef(db, `orders/${orderId}`))
    if (snapshot.exists()) {
      const data = snapshot.val()
      console.log('  ✅ Order found in RTDB!')
      console.log(`  Status: ${data.status}`)
      console.log(`  Images field present: ${!!data.images}`)
      console.log(`  Images type: ${typeof data.images}`)
      console.log(`  Images isArray: ${Array.isArray(data.images)}`)

      if (data.images) {
        const images = Array.isArray(data.images) ? data.images : Object.values(data.images)
        console.log(`  ✅ ${images.length} image URL(s) stored in RTDB`)
        images.forEach((url, i) => {
          const ok = url && url.startsWith('https://')
          console.log(`    [${i}]: ${ok ? '✅' : '❌'} ${url ? url.substring(0, 60) + '...' : 'MISSING!'}`)
          if (!ok) allPassed = false
        })
      } else {
        console.error('  ❌ No images field in order data!')
        allPassed = false
      }

      // Verify the URL actually points to Cloudinary
      if (data.images && data.images[0] && !data.images[0].includes('cloudinary.com')) {
        console.warn('  ⚠️ URL does not appear to be a Cloudinary URL')
      } else if (data.images && data.images[0]) {
        console.log('  ✅ URL is from Cloudinary (matches expected pattern)')
      }

    } else {
      console.error('  ❌ Order not found in RTDB!')
      allPassed = false
    }
  } catch (err) {
    console.error(`\n❌ STEP 3 FAILED: ${err.message}`)
    allPassed = false
  }

  // ── CLEANUP ─────────────────────────────────────────────────────────────
  console.log('\n🧹 STEP 4: Cleaning up test data...')
  try {
    // Delete from RTDB (Cloudinary cleanup would require authenticated API)
    await remove(dbRef(db, `orders/${orderId}`))
    console.log('  ✅ Test order deleted from RTDB')
    console.log('  ℹ️  Note: The Cloudinary image will auto-expire or can be' +
                '\n      removed manually from the Cloudinary Media Library.')
  } catch (err) {
    console.warn(`  ⚠️ Cleanup warning: ${err.message}`)
  }

  console.log('\n' + '═'.repeat(60))
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED — Cloudinary image upload pipeline is working!')
    console.log('   Images can be uploaded to Cloudinary and saved to RTDB.')
  } else {
    console.log('❌ SOME TESTS FAILED — Check the errors above.')
  }
  console.log('═'.repeat(60))
}

runTest().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
