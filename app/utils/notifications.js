// utils/notifications.js
// ─────────────────────────────────────────────────────────────────────────────
// Full notification system for DoToR app
// Handles: push token registration + all Rapido/Swiggy-style smart notifications
// ─────────────────────────────────────────────────────────────────────────────

import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

// ── Configure how notifications appear when app is in foreground ──────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
})

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
    content: { title, body, sound: 'default' },
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