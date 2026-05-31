import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyDGzlU-qp5Q_ht8xxIrpyeGNPLgbbKexKs',
  authDomain: 'dotor-2e4d8.firebaseapp.com',
  databaseURL: 'https://dotor-2e4d8-default-rtdb.firebaseio.com',
  projectId: 'dotor-2e4d8',
  storageBucket: 'dotor-2e4d8.firebasestorage.app',
  messagingSenderId: '984437487718',
  appId: '1:984437487718:android:c323dd93e33ea0889915a7',
}

// Google Places API key (set this to use location autocomplete)
// Get a key at https://console.cloud.google.com/apis/credentials
const googleApiKey = '' // ← Add your Google Places API key here

const GOOGLE_PLACES_API_KEY = googleApiKey || firebaseConfig.apiKey

export { GOOGLE_PLACES_API_KEY }

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)
const auth = getAuth(app)

export { db, auth }
export default app
