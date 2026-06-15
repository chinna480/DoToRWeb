// utils/notifications.js
// ─────────────────────────────────────────────────────────────────────────────
// Full notification system for DoToR app
// Handles: push token registration + all Rapido/Swiggy-style smart notifications
//          + in-app sound alerts for new jobs
// ─────────────────────────────────────────────────────────────────────────────

import { Audio } from 'expo-av'
import * as Device from 'expo-device'
import * as FileSystem from 'expo-file-system'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { db } from '../firebase/config'
import { ref, get } from 'firebase/database'
import { calcDistance } from './distance'

// ── Configure how notifications appear when app is in foreground ──────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
})

// ── Sound Alert System ────────────────────────────────────────────────────────
// Plays distinct sounds for tech job alerts, job completion, etc.
// Uses expo-av + expo-file-system to write WAV files to temp storage (reliable in RN).
// ─────────────────────────────────────────────────────────────────────────────

let soundObject = null

/**
 * Minimal Base64 encoder for Uint8Array.
 * Replaces btoa() which is not available in React Native Hermes engine.
 */
function uint8ArrayToBase64(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  let i = 0
  const len = bytes.length
  while (i < len) {
    const b1 = bytes[i++]
    const b2 = i < len ? bytes[i++] : 0
    const b3 = i < len ? bytes[i++] : 0
    result += chars[b1 >> 2] +
      chars[((b1 & 3) << 4) | (b2 >> 4)] +
      (i > len + 1 ? '=' : chars[((b2 & 15) << 2) | (b3 >> 6)]) +
      (i > len ? '=' : chars[b3 & 63])
  }
  return result
}

/**
 * Generate a WAV file and save it to a temp file, then play it via expo-av.
 * Uses custom base64 encoder (no btoa dependency).
 */
async function playWavFromSamples(samples, sampleRate) {
  try {
    if (soundObject) {
      await soundObject.unloadAsync()
      soundObject = null
    }

    const wavData = createWav(samples, sampleRate)
    const wavPath = `${FileSystem.cacheDirectory}sound_${Date.now()}.wav`

    // Convert binary WAV bytes to base64 using our own encoder (no btoa!)
    const base64 = uint8ArrayToBase64(wavData)
    await FileSystem.writeAsStringAsync(wavPath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    })

    const { sound } = await Audio.Sound.createAsync(
      { uri: wavPath },
      { shouldPlay: true }
    )
    soundObject = sound
    sound.setOnPlaybackStatusUpdate(status => {
      if (status.didJustFinish) {
        sound.unloadAsync()
        soundObject = null
        // Clean up temp file
        FileSystem.deleteAsync(wavPath, { idempotent: true }).catch(() => {})
      }
    })
  } catch (e) {
    console.log('Sound play failed:', e.message)
  }
}

/**
 * Play a tech job alert sound — distinct 3-note ascending chime.
 * This is DIFFERENT from any other sound in the app.
 * Pitches: 440Hz → 660Hz → 880Hz (like a "ding-ding-ding!")
 * Call this in TechHomeScreen when a NEW pending order appears.
 */
export async function playTechJobAlertSound() {
  try {
    const sampleRate = 8000
    const noteDuration = 0.12 // seconds per note
    const gapDuration = 0.06  // 60ms gap between notes
    const noteSamples = Math.floor(sampleRate * noteDuration)
    const gapSamples = Math.floor(sampleRate * gapDuration)

    // Three ascending notes
    const frequencies = [440, 660, 880]
    const allPieces = []

    frequencies.forEach((freq, i) => {
      const note = new Int16Array(noteSamples)
      for (let j = 0; j < noteSamples; j++) {
        const t = j / sampleRate
        note[j] = Math.sin(2 * Math.PI * freq * t) * 8000
      }
      allPieces.push(note)
      if (i < frequencies.length - 1) {
        allPieces.push(new Int16Array(gapSamples)) // gap between notes
      }
    })

    // Combine all pieces
    const totalLen = allPieces.reduce((sum, p) => sum + p.length, 0)
    const combined = new Int16Array(totalLen)
    let offset = 0
    allPieces.forEach(p => {
      combined.set(p, offset)
      offset += p.length
    })

    await playWavFromSamples(combined, sampleRate)
  } catch (e) {
    console.log('Tech job alert sound failed:', e.message)
  }
}

/**
 * Play a new-job alert sound (two ascending beeps: 660Hz → 880Hz).
 * Call this when a new order first appears.
 */
export async function playNewJobSound() {
  try {
    const sampleRate = 8000
    const duration = 0.15 // seconds per beep
    const numSamples = Math.floor(sampleRate * duration)

    // Generate two beeps: 660Hz then 880Hz
    const view1 = new Int16Array(numSamples)
    for (let i = 0; i < numSamples; i++) {
      view1[i] = Math.sin(2 * Math.PI * 660 * (i / sampleRate)) * 8000
    }

    const view2 = new Int16Array(numSamples)
    for (let i = 0; i < numSamples; i++) {
      view2[i] = Math.sin(2 * Math.PI * 880 * (i / sampleRate)) * 8000
    }

    // Create WAV blob from the two buffers combined (with small gap)
    const gapSamples = Math.floor(sampleRate * 0.1) // 100ms gap
    const combined = new Int16Array(numSamples + gapSamples + numSamples)
    combined.set(view1)
    combined.set(new Int16Array(gapSamples), numSamples)
    combined.set(view2, numSamples + gapSamples)

    await playWavFromSamples(combined, sampleRate)
  } catch (e) {
    console.log('New job sound failed:', e.message)
  }
}

/** Play a job-complete celebration sound (descending: 880Hz → 660Hz) */
export async function playJobCompleteSound() {
  try {
    const sampleRate = 8000
    const duration = 0.2
    const numSamples = Math.floor(sampleRate * duration)

    // Descending tones: 880Hz then 660Hz
    const buffer1 = new Int16Array(numSamples)
    for (let i = 0; i < numSamples; i++) {
      buffer1[i] = Math.sin(2 * Math.PI * 880 * (i / sampleRate)) * 8000
    }
    const buffer2 = new Int16Array(numSamples)
    for (let i = 0; i < numSamples; i++) {
      buffer2[i] = Math.sin(2 * Math.PI * 660 * (i / sampleRate)) * 8000
    }

    const gapSamples = Math.floor(sampleRate * 0.15)
    const combined = new Int16Array(numSamples + gapSamples + numSamples)
    combined.set(buffer1)
    combined.set(new Int16Array(gapSamples), numSamples)
    combined.set(buffer2, numSamples + gapSamples)

    await playWavFromSamples(combined, sampleRate)
  } catch (e) {
    console.log('Complete sound failed:', e.message)
  }
}

/** Generate a WAV file from PCM data */
function createWav(samples, sampleRate) {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * bitsPerSample / 8
  const blockAlign = numChannels * bitsPerSample / 8
  const dataSize = samples.length * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i], true)
  }
  return new Uint8Array(buffer)
}

// ── End Sound Alert System ────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 1. REGISTER DEVICE FOR PUSH NOTIFICATIONS
//    Call this once on login (already done in CustomerLoginScreen & HomeScreen)
// ─────────────────────────────────────────────────────────────────────────────
export async function registerForNotifications() {
  if (!Device.isDevice) {
    console.warn('Push notifications only work on real devices.')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.warn('Notification permission not granted!')
    return null
  }

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('dotor-channel', {
      name:             'DoToR Notifications',
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#FF6B00',
      sound:            'default',
    })
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data
    console.log('✅ Push token:', token)
    return token
  } catch (e) {
    console.warn('Could not get push token:', e)
    return null
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// 2. SEND PUSH NOTIFICATION (via Expo Push API)
//    Use this to send to ANY user by their saved push token
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken) {
    console.warn('sendPushNotification: no token provided, skipping.')
    return
  }

  const message = {
    to:    expoPushToken,
    sound: 'default',
    title,
    body,
    data,
    // Android styling
    android: {
      channelId: 'dotor-channel',
      color:     '#FF6B00',
      priority:  'high',
    },
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: {
        Accept:         'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })
    const result = await response.json()
    console.log('📬 Push sent:', result)
  } catch (err) {
    console.error('❌ Push send failed:', err)
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. LOCAL NOTIFICATION (shows instantly on THIS device, no token needed)
//    Use this for confirmations: booking success, OTP, etc.
// ─────────────────────────────────────────────────────────────────────────────
export async function showLocalNotification(title, body) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: 'dotor-channel' } : {}),
    },
    trigger: null, // show immediately
  })
}


// ─────────────────────────────────────────────────────────────────────────────
// 4. SMART NOTIFICATION TRIGGERS — Use these throughout your app
//    Each function wraps sendPushNotification with the right message
// ─────────────────────────────────────────────────────────────────────────────

/** Called in TechHomeScreen when a new order arrives → notify technician */
export async function notifyTechNewJob(techPushToken, customerName, brand, repair) {
  await sendPushNotification(
    techPushToken,
    '🔔 New Job Request!',
    `${customerName} needs ${brand} ${repair}. Accept now!`,
    { screen: 'TechHomeScreen' }
  )
}

/** Called when tech accepts → notify customer */
export async function notifyCustomerTechAccepted(custPushToken, techName) {
  await sendPushNotification(
    custPushToken,
    '🛵 Technician Assigned!',
    `${techName} is on the way to fix your device!`,
    { screen: 'TrackingScreen' }
  )
}

/** Called when tech is ~1 km away (check in TechHomeScreen useEffect) → notify customer */
export async function notifyCustomerTechNearby(custPushToken, etaMinutes) {
  await sendPushNotification(
    custPushToken,
    '📍 Almost There!',
    `Your technician is ${etaMinutes} mins away. Please be available!`,
    { screen: 'TrackingScreen' }
  )
}

/** Called when tech marks distance < 0.2 km → notify customer "arrived" */
export async function notifyCustomerTechArrived(custPushToken) {
  await sendPushNotification(
    custPushToken,
    '🏠 Technician Has Arrived!',
    'Your technician is at your doorstep. Please open the door!',
    { screen: 'TrackingScreen' }
  )
}

/** Called when tech marks job complete → notify customer */
export async function notifyCustomerJobDone(custPushToken) {
  await sendPushNotification(
    custPushToken,
    '✅ Repair Completed!',
    'Your device is fixed! Please rate your technician.',
    { screen: 'ReviewScreen' }
  )
}

/** Called when tech marks job complete → local notification for tech */
export async function notifyTechJobDone() {
  await showLocalNotification(
    '🎉 Job Completed!',
    'Great work! Your earnings have been updated.'
  )
}

/** Called when customer books → local confirmation */
export async function notifyCustomerBookingConfirmed(brand, repair) {
  await showLocalNotification(
    '✅ Booking Confirmed!',
    `${brand} ${repair} — A technician will be assigned shortly.`
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// 5. FREE ALTERNATIVE TO CLOUD FUNCTIONS — Notify techs directly from app
//    No server/Cloud Functions needed! Uses customer's device to send
//    push notifications to nearby technicians via Expo Push API (free).
//    Handles the "app closed" scenario by falling back to ALL registered techs.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * After a customer books a repair, this sends push notifications to technicians.
 * Call this after successfully creating an order in Firebase.
 *
 * Flow:
 * 1. Reads techsOnline to find nearby technicians (GPS-based)
 * 2. Calculates distance using Haversine formula
 * 3. Sends Expo push to nearby techs within 10km
 * 4. If no nearby techs found, falls back to ALL registered techs
 *    (handles the "app completely closed" scenario)
 *
 * @param {object} order - The order object that was just created
 * @param {number} orderId - The Firebase key of the new order
 */
export async function notifyTechsForNewOrder(order, orderId) {
  const RADIUS_KM = 10;

  const orderLat = order.custLat;
  const orderLng = order.custLng;

  console.log('🔍 [Client] Notifying techs for new order:', order.customerName);

  let notifiedTechs = 0;

  try {
    // ── STEP 1: Try to find nearby techs via GPS (techsOnline) ──
    const techsSnap = await get(ref(db, 'techsOnline'));

    if (techsSnap.exists() && orderLat && orderLng) {
      const nearbyTechs = [];

      techsSnap.forEach(child => {
        const techPhone = child.key;
        const tech = child.val();
        if (tech.lat && tech.lng) {
          const dist = parseFloat(calcDistance(orderLat, orderLng, tech.lat, tech.lng));
          console.log(`  📍 Tech ${techPhone}: ${dist.toFixed(1)} km away`);
          if (dist <= RADIUS_KM) {
            nearbyTechs.push({ phone: techPhone, distance: dist, name: tech.name || 'Technician' });
          }
        }
      });

      if (nearbyTechs.length > 0) {
        console.log(`✅ Found ${nearbyTechs.length} nearby technician(s)`);
        await notifyTechList(nearbyTechs, order, orderId);
        notifiedTechs += nearbyTechs.length;
      }
    }

    // ── STEP 2: Fallback — notify ALL registered techs (app-closed scenario) ──
    if (notifiedTechs === 0) {
      console.log('📡 No online/nearby techs — falling back to ALL registered techs');
      const allTechs = [];

      // Try techUsers first (primary path where tokens are saved)
      const usersSnap = await get(ref(db, 'techUsers'));
      if (usersSnap.exists()) {
        usersSnap.forEach(child => {
          allTechs.push({ phone: child.key, name: child.val().name || 'Technician' });
        });
      }

      // Also try legacy techs path
      const legacySnap = await get(ref(db, 'techs'));
      if (legacySnap.exists()) {
        const existingPhones = new Set(allTechs.map(t => t.phone));
        legacySnap.forEach(child => {
          if (!existingPhones.has(child.key)) {
            allTechs.push({ phone: child.key, name: child.val().name || 'Technician' });
          }
        });
      }

      if (allTechs.length > 0) {
        console.log(`📡 Notifying ${allTechs.length} registered tech(s)`);
        await notifyTechList(allTechs, order, orderId);
        notifiedTechs = allTechs.length;
      }
    }

    if (notifiedTechs === 0) {
      console.log('⏭️ No technicians could be notified');
    } else {
      console.log(`🎉 ${notifiedTechs} tech(s) notified!`);
    }
  } catch (err) {
    console.error('❌ Error notifying techs:', err);
  }
}

/**
 * Internal helper: Send push to a list of techs by looking up their push tokens
 */
async function notifyTechList(techsList, order, orderId) {
  const notifications = techsList.map(async (tech) => {
    try {
      const pushToken = await getTechToken(tech.phone);
      if (pushToken) {
        const distanceText = tech.distance != null ? ` (${tech.distance.toFixed(1)} km away)` : '';
        await sendPushNotification(
          pushToken,
          '🔔 New Job Nearby!',
          `${order.customerName} needs ${order.brand} ${order.modelName || order.description || 'repair'}${distanceText}. Accept now!`,
          { screen: 'TechHomeScreen', orderId }
        );
        console.log(`  📲 Sent push to ${tech.phone}`);
      } else {
        console.log(`  ⚠️ No push token for ${tech.phone}`);
      }
    } catch (err) {
      console.error(`  ❌ Failed to notify ${tech.phone}:`, err.message);
    }
  });

  await Promise.all(notifications);
}

/**
 * Internal helper: Look up a tech's Expo push token from multiple Firebase paths
 */
async function getTechToken(techPhone) {
  // Path 1: techUsers/{phone}/pushToken
  const userSnap = await get(ref(db, `techUsers/${techPhone}`));
  if (userSnap.exists() && userSnap.val().pushToken) {
    return userSnap.val().pushToken;
  }

  // Path 2: pushTokens/{phone}
  const tokenSnap = await get(ref(db, `pushTokens/${techPhone}`));
  if (tokenSnap.exists()) {
    const val = tokenSnap.val();
    return typeof val === 'string' ? val : val.pushToken || null;
  }

  // Path 3: techs/{phone}/pushToken (legacy path)
  const legacySnap = await get(ref(db, `techs/${techPhone}/pushToken`));
  if (legacySnap.exists()) {
    return legacySnap.val();
  }

  return null;
}