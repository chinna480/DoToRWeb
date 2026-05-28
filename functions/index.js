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

// ─────────────────────────────────────────────────────────────────────────────
// APPOINTMENT REMINDER — Scheduled Cloud Function
// Runs every 5 minutes, checks for upcoming appointments, and sends push
// notifications with sound to both customers and assigned technicians.
// ─────────────────────────────────────────────────────────────────────────────
const { onSchedule } = require('firebase-functions/v2/scheduler');

exports.appointmentReminder = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Asia/Kolkata' },
  async (event) => {
    console.log('⏰ Checking for upcoming appointment reminders...');

    try {
      const now = Date.now();
      const thirtyMinFromNow = now + 30 * 60 * 1000; // next 30 minutes
      const reminderWindow = now + 25 * 60 * 1000;  // remind between now and 25 mins from now

      // Query orders that are appointment-based, not yet reminded, with appointmentTime upcoming
      const ordersSnap = await admin.database()
        .ref('orders')
        .orderByChild('appointmentTime')
        .startAt(now)
        .endAt(thirtyMinFromNow)
        .once('value');

      if (!ordersSnap.exists()) {
        console.log('⏭️ No upcoming appointments found');
        return;
      }

      let remindedCount = 0;

      const promises = [];
      ordersSnap.forEach(child => {
        const order = child.val();
        const orderId = child.key;

        // Only process appointment-based orders that haven't been reminded
        if (!order.isAppointment || order.reminderSent) return;
        if (!order.appointmentTime) return;

        // Mark as reminded so we don't spam
        promises.push(
          admin.database().ref(`orders/${orderId}/reminderSent`).set(true)
        );

        const apptLabel = `${order.dateLabel || order.date || ''} at ${order.timeSlot || order.time || ''}`;
        const custToken = order.customerPushToken;

        // ── Send reminder to customer ────────────────────────────────────
        if (custToken) {
          console.log(`  📲 Reminding customer ${order.customerName} about ${apptLabel}`);
          promises.push(
            sendExpoPush(
              custToken,
              '⏰ Appointment Reminder',
              `Your appointment at ${order.timeSlot || order.time} is in about 30 minutes! A technician will be there soon.`,
              { screen: 'HomeScreen', orderId }
            )
          );
          // Also send a second notification at the exact appointment time
          const apptTime = order.appointmentTime;
          const delayMs = apptTime - now;
          if (delayMs > 0 && delayMs <= 1800000) {
            // Schedule a second push via setTimeout within the function runtime
            // Note: function max runtime is 9 mins for pubsub, so only for appointments within 9 mins
            if (delayMs <= 540000) { // 9 minutes
              setTimeout(async () => {
                await sendExpoPush(
                  custToken,
                  '🔔 Appointment Time!',
                  `Your appointment at ${order.timeSlot || order.time} is starting now! Your technician is on the way.`,
                  { screen: 'TrackingScreen', orderId }
                );
              }, delayMs);
            }
          }
        } else {
          console.log(`  ⚠️ No push token for customer ${order.customerName}`);
        }

        // ── Send reminder to assigned technician ─────────────────────────
        if (order.techName && order.techPhone) {
          // Look up tech's push token
          promises.push(
            (async () => {
              try {
                const userSnap = await admin.database()
                  .ref(`techUsers/${order.techPhone}`)
                  .once('value');
                let techToken = null;
                if (userSnap.exists()) {
                  techToken = userSnap.val().pushToken;
                }
                if (!techToken) {
                  const tokenSnap = await admin.database()
                    .ref(`pushTokens/${order.techPhone}`)
                    .once('value');
                  if (tokenSnap.exists()) techToken = tokenSnap.val();
                }
                if (techToken) {
                  console.log(`  📲 Reminding tech ${order.techName} about appointment at ${apptLabel}`);
                  await sendExpoPush(
                    techToken,
                    '⏰ Appointment Reminder',
                    `Scheduled repair for ${order.customerName} at ${order.timeSlot || order.time} is in about 30 minutes! Head to ${order.location || 'the customer'}.`,
                    { screen: 'TechHomeScreen', orderId }
                  );
                }
              } catch (err) {
                console.error(`  ❌ Failed to remind tech ${order.techName}:`, err.message);
              }
            })()
          );
        }

        remindedCount++;
      });

      await Promise.all(promises);
      console.log(`✅ ${remindedCount} appointment reminder(s) sent`);

    } catch (err) {
      console.error('❌ Error in appointmentReminder function:', err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────

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

    if (!order || order.status !== 'pending') {
      console.log('⏭️ Skipping non-pending order');
      return null;
    }

    const orderLat = order.custLat;
    const orderLng = order.custLng;

    console.log(`🔍 New order: ${order.customerName} — ${order.brand} ${order.repair}`);

    let notifiedTechs = 0;

    try {
      // ── STEP 1: Try to find nearby techs via GPS (techsOnline) ──
      const techsSnapshot = await admin.database().ref('techsOnline').once('value');

      if (techsSnapshot.exists() && orderLat && orderLng) {
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

        if (nearbyTechs.length > 0) {
          console.log(`✅ Found ${nearbyTechs.length} nearby technician(s)`);
          notifiedTechs += await notifyTechsList(nearbyTechs, order, context.params.orderId);
        } else {
          console.log('⏭️ No nearby techs within ' + RADIUS_KM + 'km');
        }
      }

      // ── STEP 2: If no GPS coords or no nearby techs found, fall back to ALL registered techs ──
      // This is the key fix — handles the case when the app is closed (tech not in techsOnline)
      if (notifiedTechs === 0) {
        console.log('📡 No online/nearby techs — falling back to ALL registered techs');
        notifiedTechs += await notifyAllRegisteredTechs(order, context.params.orderId);
      }

      if (notifiedTechs === 0) {
        console.log('⏭️ No technicians could be notified (no push tokens found)');
      } else {
        console.log(`🎉 ${notifiedTechs} tech(s) notified!`);
      }
    } catch (err) {
      console.error('❌ Error in newOrderNotification:', err);
    }

    return null;
  });

/**
 * Send push notifications to a list of technicians
 */
async function notifyTechsList(techsList, order, orderId) {
  let count = 0;
  const notifications = techsList.map(async (tech) => {
    try {
      const pushToken = await getTechPushToken(tech.phone);
      if (pushToken) {
        const distanceText = tech.distance != null ? ` (${tech.distance.toFixed(1)} km away)` : '';
        await sendExpoPush(
          pushToken,
          '🔔 New Job Nearby!',
          `${order.customerName} needs ${order.brand} ${order.repair}${distanceText}. Accept now!`,
          { screen: 'TechHomeScreen', orderId }
        );
        count++;
        console.log(`  📲 Sent push to ${tech.phone}`);
      } else {
        console.log(`  ⚠️ No push token for ${tech.phone}`);
      }
    } catch (err) {
      console.error(`  ❌ Failed to notify ${tech.phone}:`, err.message);
    }
  });
  await Promise.all(notifications);
  return count;
}

/**
 * Look up a tech's Expo push token from multiple storage paths
 */
async function getTechPushToken(techPhone) {
  // Path 1: techUsers/{phone}/pushToken
  const userSnap = await admin.database().ref(`techUsers/${techPhone}`).once('value');
  if (userSnap.exists() && userSnap.val().pushToken) {
    return userSnap.val().pushToken;
  }

  // Path 2: pushTokens/{phone}
  const tokenSnap = await admin.database().ref(`pushTokens/${techPhone}`).once('value');
  if (tokenSnap.exists()) {
    const val = tokenSnap.val();
    // Could be a string (direct) or an object with pushToken
    return typeof val === 'string' ? val : val.pushToken || null;
  }

  // Path 3: techs/{phone}/pushToken (legacy path)
  const legacySnap = await admin.database().ref(`techs/${techPhone}/pushToken`).once('value');
  if (legacySnap.exists()) {
    return legacySnap.val();
  }

  return null;
}

/**
 * Fallback: notify ALL registered technicians (handles app-closed scenario)
 * Reads from techs/ collection and sends push to every tech with a token
 */
async function notifyAllRegisteredTechs(order, orderId) {
  try {
    // Try techUsers first (primary path)
    const usersSnap = await admin.database().ref('techUsers').once('value');
    let techs = [];

    if (usersSnap.exists()) {
      usersSnap.forEach(child => {
        techs.push({ phone: child.key, name: child.val().name || 'Technician' });
      });
    }

    // Also try legacy techs/ path
    const legacySnap = await admin.database().ref('techs').once('value');
    if (legacySnap.exists()) {
      const existingPhones = new Set(techs.map(t => t.phone));
      legacySnap.forEach(child => {
        if (!existingPhones.has(child.key)) {
          techs.push({ phone: child.key, name: child.val().name || 'Technician' });
        }
      });
    }

    if (techs.length === 0) {
      console.log('⚠️ No registered techs found');
      return 0;
    }

    console.log(`📡 Notifying ${techs.length} registered tech(s) (app-closed fallback)`);
    return await notifyTechsList(techs, order, orderId);
  } catch (err) {
    console.error('❌ Error in notifyAllRegisteredTechs:', err);
    return 0;
  }
}

