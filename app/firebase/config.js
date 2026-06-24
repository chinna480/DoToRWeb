import { initializeApp } from 'firebase/app'
import { get, getDatabase, ref, update } from 'firebase/database'
import { calcDistance } from '../utils/distance'

const firebaseConfig = {
  apiKey: 'AIzaSyDGzlU-qp5Q_ht8xxIrpyeGNPLgbbKexKs',
  authDomain: 'dotor-2e4d8.firebaseapp.com',
  databaseURL: 'https://dotor-2e4d8-default-rtdb.firebaseio.com',
  projectId: 'dotor-2e4d8',
  storageBucket: 'dotor-2e4d8.firebasestorage.app',
  messagingSenderId: '984437487718',
  appId: '1:984437487718:android:c323dd93e33ea0889915a7',
}

// LocationIQ API key (free alternative to Google Places for autocomplete)
// Get a free key at https://locationiq.com/
const LOCATIONIQ_API_KEY = 'pk.aebf99966af8f11ff8507421ec0def62'

export { LOCATIONIQ_API_KEY }

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

// ── Storage removed ───────────────────────────────────────────────────────
// Firebase Storage requires Blaze (paid) plan.
// Images are now uploaded via Cloudinary (free) in utils/uploadImage.js
// ─────────────────────────────────────────────────────────────────────────

// ── AUTO-ASSIGN NEAREST TECHNICIAN ────────────────────────────────────────
// MAX_DISTANCE_KM: only techs within this radius from the customer are eligible
const MAX_AUTO_ASSIGN_KM = 5

export async function autoAssignNearestTech(orderId, lat, lng, pincode, excludePhones = []) {
  if (!orderId) return null
  try {
    // Get all available techs
    const techs = []
    const usersSnap = await get(ref(db, 'techUsers'))
    if (usersSnap.exists()) {
      usersSnap.forEach(child => {
        const data = child.val()
        techs.push({ phone: child.key, ...data })
      })
    }

    if (techs.length === 0) {
      console.log('⚠️ No technicians available for auto-assign')
      return null
    }

    // Score & filter techs: prefer same pincode, within 5 km, exclude rejectors
    const scored = techs
      .filter(t => !excludePhones.includes(t.phone))
      .map(t => {
        let score = 0
        let distance = null

        // ── Both customer and tech have GPS: use distance ──
        if (t.lat && t.lng && lat && lng) {
          distance = parseFloat(calcDistance(lat, lng, t.lat, t.lng))

          // 5 km radius filter — exclude far-away techs
          if (distance > MAX_AUTO_ASSIGN_KM) {
            return { ...t, score: -1, _distance: distance, _outOfRange: true }
          }

          score += Math.max(0, 50 - distance) // Closer = more points
        }
        // ── Customer has GPS but tech doesn't: only allow if same pincode/region ──
        else if (lat && lng) {
          const techPin = t.pincode ? t.pincode.toString() : ''
          const custPin = pincode ? pincode.toString() : ''
          const samePincode = techPin === custPin
          const sameRegion = techPin.length >= 3 && custPin.length >= 3 &&
                             techPin.substring(0, 3) === custPin.substring(0, 3)

          if (!samePincode && !sameRegion) {
            return { ...t, score: -1, _distance: null, _outOfRange: true }
          }

          if (samePincode) score += 100
          else if (sameRegion) score += 50
        }
        // ── Customer has no GPS: pincode-only matching ──
        else {
          if (t.pincode && pincode && t.pincode.toString() === pincode.toString()) {
            score += 100
          }
        }

        return { ...t, score, _distance: distance, _outOfRange: false }
      })
      // Remove out-of-range techs entirely
      .filter(t => !t._outOfRange)

    if (scored.length === 0) {
      console.log('⚠️ No in-range technicians available for auto-assign (5 km radius)')
      return null
    }

    // Sort by score descending, then by distance ascending
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (a._distance || 999) - (b._distance || 999)
    })

    const bestTech = scored[0]
    if (!bestTech) return null

    // Assign the tech to the order
    await update(ref(db, 'orders/' + orderId), {
      techPhone: bestTech.phone,
      techName: bestTech.name || 'Technician',
      techPhoto: bestTech.photo || null,
      techArea: bestTech.location || null,
      techExp: bestTech.exp || bestTech.experience || null,
      status: 'accepted',
      assignedAt: Date.now(),
      autoAssigned: true,
    })

    console.log('✅ Auto-assigned tech:', bestTech.phone, 'to order:', orderId)
    return { techPhone: bestTech.phone, techName: bestTech.name, techPhoto: bestTech.photo, techArea: bestTech.location, techExp: bestTech.exp || bestTech.experience }
  } catch (err) {
    console.error('❌ Auto-assign failed:', err)
    return null
  }
}

export { db }