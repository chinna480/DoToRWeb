import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyDS0hDsfqwMiMg5S9Ztp8eku83XerVtbdY",
  authDomain: "dotor-2e4d8.firebaseapp.com",
  databaseURL: "https://dotor-2e4d8-default-rtdb.firebaseio.com",
  projectId: "dotor-2e4d8",
  storageBucket: "dotor-2e4d8.firebasestorage.app",
  messagingSenderId: "984437487718",
  appId: "1:984437487718:web:3d279fdf6e720f119915a7"
}

const app = initializeApp(firebaseConfig)
export const db      = getDatabase(app)
export const storage = getStorage(app)   // ← needed for Aadhar/Certificate upload