/**
 * DoToR Background Push Notifications
 * ─────────────────────────────────────────────────────────────────────────
 * Sends push notifications to nearby technicians when a new repair order
 * is created — even if the technician's app is closed.
 *
 * How it works:
 * 1. Triggers on Firebase Realtime Database: orders/{orderId}
 * 2. When a new order with status "pending" is created with GPS coords,
 *    the function reads all technicians in `techsOnline/{techPhone}`
 * 3. For each tech, calculates Haversine distance to the order
 * 4. If distance <= 10km (RADIUS_KM), looks up the tech's push token
 *    and sends a push notification via Expo Push API
 *
 * Deploy:
 *   firebase deploy --only functions
 * ─────────────────────────────────────────────────────────────────────────
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

const RADIUS_KM = 10; // Only notify techs within 10km

/**
 * Calculate Haversine distance between two GPS points
 */
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Send push notification via Expo Push API
 */
async function sendExpoPush(expoPushToken, title, body, data = {}) {
  if (!expoPushToken) return;

  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
    android: {
      channelId: 'dotor-channel',
      color: '#FF6B00',
      priority: 'high',
    },
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    const result = await response.json();
    console.log('📬 Expo push sent:', JSON.stringify(result));
  } catch (err) {
    console.error('❌ Expo push failed:', err);
  }
}

/**
 * Cloud Function: newOrderNotification
 * ──────────────────────────────────────────
 * Triggered when a new order is created in Firebase RTDB.
 * Finds nearby technicians and sends them push notifications.
 */
exports.newOrderNotification = functions.database
  .ref('/orders/{orderId}')
  .onCreate(async (snapshot, context) => {
    const order = snapshot.val();

    // Only process pending orders with GPS coordinates
    if (!order || order.status !== 'pending') {
      console.log('⏭️ Skipping non-pending order');
      return null;
    }

    const orderLat = order.custLat;
    const orderLng = order.custLng;

    // If no GPS coords, fall back to notifying ALL techs (pincode/area based)
    if (!orderLat || !orderLng) {
      console.log('⚠️ Order has no GPS coords, notifying all techs');
      await notifyAllTechs(order);
      return null;
    }

    console.log(`🔍 New order: ${order.customerName} — ${order.brand} ${order.repair} [${orderLat}, ${orderLng}]`);

    try {
      // Read all online technicians
      const techsSnapshot = await admin.database().ref('techsOnline').once('value');

      if (!techsSnapshot.exists()) {
        console.log('⏭️ No online technicians found');
        return null;
      }

      const nearbyTechs = [];

      techsSnapshot.forEach(child => {
        const techPhone = child.key;
        const tech = child.val();
        const techLat = tech.lat;
        const techLng = tech.lng;

        if (techLat && techLng) {
          const dist = calcDistance(orderLat, orderLng, techLat, techLng);
          console.log(`  📍 Tech ${techPhone}: ${dist.toFixed(1)} km away`);
          if (dist <= RADIUS_KM) {
            nearbyTechs.push({ phone: techPhone, distance: dist, name: tech.name || 'Technician' });
          }
        }
      });

      if (nearbyTechs.length === 0) {
        console.log('⏭️ No nearby technicians found within ' + RADIUS_KM + 'km');
        return null;
      }

      console.log(`✅ Found ${nearbyTechs.length} nearby technician(s)`);

      // Send push notification to each nearby tech
      const notifications = nearbyTechs.map(async (tech) => {
        // Look up the tech's push token from their profile or techUsers
        try {
          // Try fetching from techUsers/{phone}
          const userSnap = await admin.database().ref(`techUsers/${tech.phone}`).once('value');
          let pushToken = null;

          if (userSnap.exists()) {
            pushToken = userSnap.val().pushToken;
          }

          // Fallback: try reading from pushTokens/{phone}
          if (!pushToken) {
            const tokenSnap = await admin.database().ref(`pushTokens/${tech.phone}`).once('value');
            if (tokenSnap.exists()) {
              pushToken = tokenSnap.val();
            }
          }

          if (pushToken) {
            await sendExpoPush(
              pushToken,
              '🔔 New Job Nearby!',
              `${order.customerName} needs ${order.brand} ${order.repair} (${tech.distance.toFixed(1)} km away). Accept now!`,
              { screen: 'TechHomeScreen', orderId: context.params.orderId }
            );
            console.log(`  📲 Sent push to ${tech.phone} (${tech.distance.toFixed(1)} km)`);
          } else {
            console.log(`  ⚠️ No push token for ${tech.phone}`);
          }
        } catch (err) {
          console.error(`  ❌ Failed to notify ${tech.phone}:`, err.message);
        }
      });

      await Promise.all(notifications);
      console.log('🎉 All nearby technicians notified!');
    } catch (err) {
      console.error('❌ Error processing new order:', err);
    }

    return null;
  });

/**
 * Fallback: notify ALL online techs when order has no GPS coords
 */
async function notifyAllTechs(order) {
  try {
    const techsSnapshot = await admin.database().ref('techsOnline').once('value');
    if (!techsSnapshot.exists()) return;

    const notifications = [];

    techsSnapshot.forEach(child => {
      const techPhone = child.key;
      const tech = child.val();

      const notify = (async () => {
        const userSnap = await admin.database().ref(`techUsers/${techPhone}`).once('value');
        let pushToken = userSnap.exists() ? userSnap.val().pushToken : null;
        if (!pushToken) {
          const tokenSnap = await admin.database().ref(`pushTokens/${techPhone}`).once('value');
          if (tokenSnap.exists()) pushToken = tokenSnap.val();
        }
        if (pushToken) {
          await sendExpoPush(
            pushToken,
            '🔔 New Repair Request!',
            `${order.customerName} needs ${order.brand} ${order.repair}. Accept now!`,
            { screen: 'TechHomeScreen' }
          );
        }
      })();

      notifications.push(notify);
    });

    await Promise.all(notifications);
  } catch (err) {
    console.error('❌ Error notifying all techs:', err);
  }
}
