import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

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

export { db }