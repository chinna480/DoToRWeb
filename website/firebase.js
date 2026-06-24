// website/firebase.js — Shared Firebase config & database functions
// Connects to the same Firebase as the mobile app

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  onValue,
  off,
  get,
  query,
  orderByChild,
  equalTo,
  limitToLast,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import {
  getMessaging,
  getToken,
  onMessage,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';

// ── Firebase Configuration (same as mobile app) ───────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyDGzlU-qp5Q_ht8xxIrpyeGNPLgbbKexKs',
  authDomain: 'dotor-2e4d8.firebaseapp.com',
  databaseURL: 'https://dotor-2e4d8-default-rtdb.firebaseio.com',
  projectId: 'dotor-2e4d8',
  storageBucket: 'dotor-2e4d8.firebasestorage.app',
  messagingSenderId: '984437487718',
  appId: '1:984437487718:android:c323dd93e33ea0889915a7',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ── FCM / Push Notification setup ──────────────────────────────────────────
const FCM_VAPID_KEY = 'BKyTEa7xh-HWeQ14JX0PDp6z8tpWqpr-Ky5_dHmYNJdxrlQj_MqGW5zYyUJmTPrRnxnJjMk-d-jWEpkSDSaTmyY';

let messagingInstance = null;
let swRegistration = null;

export async function setupFCM() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('🔕 Push notifications not supported in this browser');
      return null;
    }
    if (Notification.permission === 'denied') {
      console.log('🔕 Notification permission denied');
      return null;
    }
    swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ Service worker registered');
    await navigator.serviceWorker.ready;
    messagingInstance = getMessaging(app);
    const token = await getToken(messagingInstance, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    if (token) {
      console.log('✅ FCM token obtained');
      onMessage(messagingInstance, (payload) => {
        console.log('📩 Foreground push received:', payload);
        const title = payload.notification?.title || 'DoToR';
        const body = payload.notification?.body || '';
        if (title && body && typeof window.showToast === 'function') {
          window.showToast('📩 ' + title + ': ' + body, 'success');
        }
      });
      return token;
    }
    console.warn('⚠️ No FCM token returned');
    return null;
  } catch (err) {
    console.error('❌ FCM setup failed:', err);
    return null;
  }
}

export async function saveFcmToken(phone, token) {
  if (!phone || !token) return;
  try {
    await set(ref(db, 'users/' + phone + '/fcmToken'), token);
    await set(ref(db, 'users/' + phone + '/fcmTokenUpdatedAt'), Date.now());
  } catch (err) {
    console.error('❌ Failed to save FCM token:', err);
  }
}

export async function removeFcmToken(phone) {
  if (!phone) return;
  try {
    await set(ref(db, 'users/' + phone + '/fcmToken'), null);
  } catch (err) {
    console.error('❌ Failed to remove FCM token:', err);
  }
}

// ── Constants ──────────────────────────────────────────────────────────────
const PHONE_BRANDS  = ['iPhone','Samsung','OnePlus','Redmi','Vivo','Oppo','Realme','Nokia'];
const LAPTOP_BRANDS = ['Dell','HP','Lenovo','MacBook','Asus','Acer','MSI','Sony'];
const TV_BRANDS = ['Samsung','LG','Sony','Panasonic','Toshiba','MI','OnePlus','TCL'];
const AC_BRANDS = ['Voltas','LG','Samsung','Blue Star','Daikin','Hitachi','Panasonic','Lloyd'];
const FRIDGE_BRANDS = ['Samsung','LG','Whirlpool','Godrej','Haier','Panasonic','Bosch','Hitachi'];
const WM_BRANDS = ['Samsung','LG','Whirlpool','Bosch','IFB','Godrej','Panasonic','Haier'];

const SERVICE_CATEGORIES = [
  { key: 'mobile',       icon: '📱', label: 'Mobile Repair',             hasDeviceFlow: true },
  { key: 'laptop',       icon: '💻', label: 'Laptop & PC Repair',        hasDeviceFlow: true },
  { key: 'tv',           icon: '📺', label: 'TV Repair',                 hasDeviceFlow: true },
  { key: 'ac',           icon: '❄️', label: 'AC Service & Repair',       hasDeviceFlow: true },
  { key: 'refrigerator', icon: '🧊', label: 'Refrigerator Repair',       hasDeviceFlow: true },
  { key: 'washing',      icon: '🧺', label: 'Washing Machine Repair',     hasDeviceFlow: true },
  { key: 'electrician',  icon: '🔌', label: 'Electrician Services',      hasDeviceFlow: false },
  { key: 'plumbing',     icon: '🚰', label: 'Plumbing Services',          hasDeviceFlow: false },
  { key: 'cctv',         icon: '📡', label: 'CCTV Installation & Service', hasDeviceFlow: false },
  { key: 'wifi',         icon: '🌐', label: 'Wi-Fi Router Setup',        hasDeviceFlow: false },
  { key: 'ro',           icon: '💧', label: 'RO Water Purifier Service', hasDeviceFlow: false },
  { key: 'inverter',     icon: '🔋', label: 'Inverter & UPS Service',    hasDeviceFlow: false },
];

const SERVICE_BRANDS = {
  mobile: PHONE_BRANDS,
  laptop: LAPTOP_BRANDS,
  tv: TV_BRANDS,
  ac: AC_BRANDS,
  refrigerator: FRIDGE_BRANDS,
  washing: WM_BRANDS,
};

const TIME_SLOTS = [
  '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00',
  '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00',
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── SERVICE PRICING ─────────────────────────────────────────────────────────
// Returns estimated price range for a given service category
export function getServicePriceEstimate(serviceKey) {
  const prices = {
    mobile:       { min: 199,  max: 1499, label: 'Mobile Repair',          eta: '30-45 mins' },
    laptop:       { min: 299,  max: 2499, label: 'Laptop Repair',          eta: '45-60 mins' },
    tv:           { min: 299,  max: 1999, label: 'TV Repair',              eta: '45-60 mins' },
    ac:           { min: 399,  max: 2999, label: 'AC Service',             eta: '45-60 mins' },
    refrigerator: { min: 299,  max: 1999, label: 'Refrigerator Repair',    eta: '45-60 mins' },
    washing:      { min: 299,  max: 1999, label: 'Washing Machine Repair', eta: '45-60 mins' },
    electrician:  { min: 149,  max: 999,  label: 'Electrician',            eta: '30-45 mins' },
    plumbing:     { min: 149,  max: 999,  label: 'Plumbing',               eta: '30-45 mins' },
    cctv:         { min: 499,  max: 3999, label: 'CCTV',                   eta: '45-60 mins' },
    wifi:         { min: 199,  max: 999,  label: 'Wi-Fi Setup',            eta: '30-45 mins' },
    ro:           { min: 299,  max: 1499, label: 'RO Purifier',            eta: '45-60 mins' },
    inverter:     { min: 299,  max: 1999, label: 'Inverter/UPS',           eta: '45-60 mins' },
  };
  return prices[serviceKey] || { min: 199, max: 999, label: 'Service', eta: '30-45 mins' };
}

// ── REFERRAL / REWARDS SYSTEM ──────────────────────────────────────────────
export async function saveReferralCode(phone, referralCode) {
  if (!phone || !referralCode) return;
  try {
    await set(ref(db, 'referrals/' + phone + '/myCode'), referralCode);
    await set(ref(db, 'referrals/' + phone + '/createdAt'), Date.now());
    console.log('✅ Referral code saved:', referralCode);
  } catch (err) {
    console.error('❌ Failed to save referral code:', err);
  }
}

export async function applyReferralCode(phone, referredByCode) {
  if (!phone || !referredByCode) return null;
  try {
    // Find who owns this referral code
    const refsSnap = await get(ref(db, 'referrals'));
    let referrerPhone = null;
    if (refsSnap.exists()) {
      refsSnap.forEach(child => {
        const data = child.val();
        if (data.myCode === referredByCode) {
          referrerPhone = child.key;
        }
      });
    }
    if (!referrerPhone || referrerPhone === phone) return null;

    // Save referral relationship
    await set(ref(db, 'referrals/' + phone + '/referredBy'), referredByCode);
    await set(ref(db, 'referrals/' + phone + '/referredByPhone'), referrerPhone);
    await set(ref(db, 'referrals/' + phone + '/referredAt'), Date.now());

    // Add rewards (₹50 off for both parties)
    await set(ref(db, 'rewards/' + phone + '/discount'), 50);
    await set(ref(db, 'rewards/' + phone + '/reason'), 'Signup via referral');
    await set(ref(db, 'rewards/' + phone + '/updatedAt'), Date.now());

    if (referrerPhone) {
      // Get existing rewards for referrer
      const rSnap = await get(ref(db, 'rewards/' + referrerPhone));
      const existingDiscount = rSnap.exists() ? (rSnap.val().discount || 0) : 0;
      await set(ref(db, 'rewards/' + referrerPhone + '/discount'), existingDiscount + 50);
      await set(ref(db, 'rewards/' + referrerPhone + '/reason'), 'Referral bonus');
      await set(ref(db, 'rewards/' + referrerPhone + '/updatedAt'), Date.now());
    }

    console.log('✅ Referral applied:', referredByCode);
    return { discount: 50, referrerPhone };
  } catch (err) {
    console.error('❌ Failed to apply referral:', err);
    return null;
  }
}

export async function getRewards(phone) {
  if (!phone) return { discount: 0 };
  try {
    const snap = await get(ref(db, 'rewards/' + phone));
    return snap.exists() ? snap.val() : { discount: 0 };
  } catch (err) {
    return { discount: 0 };
  }
}

export async function useReward(phone, amount) {
  if (!phone || !amount) return false;
  try {
    const snap = await get(ref(db, 'rewards/' + phone));
    if (!snap.exists()) return false;
    const current = snap.val().discount || 0;
    if (current < amount) return false;
    await set(ref(db, 'rewards/' + phone + '/discount'), current - amount);
    await set(ref(db, 'rewards/' + phone + '/lastUsed'), Date.now());
    return true;
  } catch (err) {
    console.error('❌ Failed to use reward:', err);
    return false;
  }
}

// ── SUPPORT TICKET SYSTEM ─────────────────────────────────────────────────
export async function createSupportTicket(customerPhone, orderId, subject, message) {
  try {
    const ticketRef = push(ref(db, 'supportTickets'));
    const ticket = {
      customerPhone,
      orderId: orderId || null,
      subject: subject || 'General Issue',
      message: message || '',
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await set(ticketRef, ticket);
    console.log('✅ Support ticket created:', ticketRef.key);
    return { ticketId: ticketRef.key, ...ticket };
  } catch (err) {
    console.error('❌ Failed to create support ticket:', err);
    throw err;
  }
}

export function listenSupportTickets(customerPhone, callback) {
  const ticketsRef = ref(db, 'supportTickets');
  const listener = onValue(ticketsRef, (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const tickets = [];
    snapshot.forEach(child => {
      const val = child.val();
      if (val.customerPhone === customerPhone) {
        tickets.push({ id: child.key, ...val });
      }
    });
    callback(tickets.reverse());
  });
  return () => off(ticketsRef, 'value', listener);
}

// ── COUNT TECHNICIANS AVAILABLE IN AREA ──────────────────────────────────
export async function countTechsInPincode(pincode) {
  if (!pincode || pincode.length < 4) return 0;
  try {
    let count = 0;
    const usersSnap = await get(ref(db, 'techUsers'));
    if (usersSnap.exists()) {
      usersSnap.forEach(child => {
        const data = child.val();
        if (data.pincode && data.pincode.toString() === pincode.toString()) {
          count++;
        }
      });
    }
    return count;
  } catch (err) {
    console.error('❌ Failed to count techs:', err);
    return 0;
  }
}

export async function countOnlineTechs() {
  try {
    const snap = await get(ref(db, 'techsOnline'));
    return snap.exists() ? (snap.size || Object.keys(snap.val()).length) : 0;
  } catch (err) {
    return 0;
  }
}

// ── AUTO-ASSIGN NEAREST TECHNICIAN ────────────────────────────────────────
export async function autoAssignNearestTech(orderId, lat, lng, pincode) {
  if (!orderId) return null;
  try {
    // Get all available techs
    const techs = [];
    const usersSnap = await get(ref(db, 'techUsers'));
    if (usersSnap.exists()) {
      usersSnap.forEach(child => {
        const data = child.val();
        techs.push({ phone: child.key, ...data });
      });
    }

    if (techs.length === 0) {
      console.log('⚠️ No technicians available for auto-assign');
      return null;
    }

    // Score techs: prefer same pincode, then nearby
    let scored = techs.map(t => {
      let score = 0;
      if (t.pincode && pincode && t.pincode.toString() === pincode.toString()) {
        score += 100; // Same pincode = high priority
      }
      if (t.lat && t.lng && lat && lng) {
        const dist = calcDistance(lat, lng, t.lat, t.lng);
        score += Math.max(0, 50 - parseFloat(dist)); // Closer = more points
        t._distance = parseFloat(dist);
      }
      return { ...t, score };
    });

    // Sort by score descending, then by distance ascending
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a._distance || 999) - (b._distance || 999);
    });

    const bestTech = scored[0];
    if (!bestTech) return null;

    // Assign the tech to the order
    await update(ref(db, 'orders/' + orderId), {
      techPhone: bestTech.phone,
      techName: bestTech.name || 'Technician',
      status: 'accepted',
      assignedAt: Date.now(),
      autoAssigned: true,
    });

    console.log('✅ Auto-assigned tech:', bestTech.phone, 'to order:', orderId);
    return { techPhone: bestTech.phone, techName: bestTech.name };
  } catch (err) {
    console.error('❌ Auto-assign failed:', err);
    return null;
  }
}

// ── SCHEDULED BOOKING REMINDER ────────────────────────────────────────────
export async function scheduleReminder(orderId, appointmentTime, phone) {
  if (!orderId || !appointmentTime) return;
  try {
    await set(ref(db, 'reminders/' + orderId), {
      orderId,
      phone,
      appointmentTime,
      createdAt: Date.now(),
      sent: false,
    });
    console.log('✅ Reminder scheduled for order:', orderId);
  } catch (err) {
    console.error('❌ Failed to schedule reminder:', err);
  }
}

// ── CREATE ORDER ──────────────────────────────────────────────────────────
export async function createOrder(orderData) {
  try {
    const orderRef = push(ref(db, 'orders'));
    const orderId = orderRef.key;

    const order = {
      customerName:    orderData.customerName || orderData.name,
      customerPhone:   orderData.customerPhone || orderData.phone,
      location:        orderData.location || '',
      pincode:         orderData.pincode || '',
      serviceCategory: orderData.serviceCategory || null,
      serviceLabel:    orderData.serviceLabel || null,
      device:          orderData.device || null,
      brand:           orderData.brand || null,
      modelName:       orderData.modelName || orderData.model || '',
      description:     (orderData.description || '').trim(),
      status:          'pending',
      createdAt:       Date.now(),
      time:            orderData.time || new Date().toLocaleTimeString(),
      custLat:         orderData.lat || null,
      custLng:         orderData.lng || null,
      images:          orderData.images || [],
      videos:          orderData.videos || [],
      ...(orderData.isAppointment && {
        isAppointment: true,
        appointmentTime: orderData.appointmentTime,
        date: orderData.date,
        dateLabel: orderData.dateLabel,
        timeSlot: orderData.timeSlot,
        reminderSent: false,
      }),
      // Multi-service support
      multiServices: orderData.multiServices || null,
      // Rewards
      discountApplied: orderData.discountApplied || 0,
      referralCode: orderData.referralCode || null,
    };

    await set(ref(db, 'orders/' + orderId), order);
    console.log('✅ Order created:', orderId);

    // Auto-assign if GPS coords available
    if (orderData.lat && orderData.lng) {
      setTimeout(() => {
        autoAssignNearestTech(orderId, orderData.lat, orderData.lng, orderData.pincode);
      }, 100);
    }

    // Schedule reminder if appointment
    if (orderData.isAppointment && orderData.appointmentTime) {
      scheduleReminder(orderId, orderData.appointmentTime, orderData.customerPhone);
    }

    return { orderId, order };
  } catch (err) {
    console.error('❌ Failed to create order:', err);
    throw err;
  }
}

// ── ORDER LISTENERS ───────────────────────────────────────────────────────
export function listenOrders(callback) {
  const ordersRef = ref(db, 'orders');
  const listener = onValue(ordersRef, (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const orders = [];
    snapshot.forEach(child => {
      const val = child.val();
      const order = { id: child.key, ...val };
      if (order.images && !Array.isArray(order.images)) {
        order.images = Object.values(order.images);
      }
      if (order.videos && !Array.isArray(order.videos)) {
        order.videos = Object.values(order.videos);
      }
      orders.push(order);
    });
    callback(orders.reverse());
  });
  return () => off(ordersRef, 'value', listener);
}

export function listenCustomerOrders(phone, callback) {
  const ordersRef = ref(db, 'orders');
  const listener = onValue(ordersRef, (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const orders = [];
    snapshot.forEach(child => {
      const val = child.val();
      if (val.customerPhone === phone) {
        const order = { id: child.key, ...val };
        if (order.images && !Array.isArray(order.images)) {
          order.images = Object.values(order.images);
        }
        if (order.videos && !Array.isArray(order.videos)) {
          order.videos = Object.values(order.videos);
        }
        orders.push(order);
      }
    });
    callback(orders.reverse());
  });
  return () => off(ordersRef, 'value', listener);
}

export function listenOrder(orderId, callback) {
  const orderRef = ref(db, 'orders/' + orderId);
  const listener = onValue(orderRef, (snapshot) => {
    if (!snapshot.exists()) { callback(null); return; }
    const val = snapshot.val();
    const order = { id: orderId, ...val };
    if (order.images && !Array.isArray(order.images)) {
      order.images = Object.values(order.images);
    }
    if (order.videos && !Array.isArray(order.videos)) {
      order.videos = Object.values(order.videos);
    }
    callback(order);
  });
  return () => off(orderRef, 'value', listener);
}

export async function updateOrderStatus(orderId, status, extraData = {}) {
  try {
    await update(ref(db, 'orders/' + orderId), { status, ...extraData });
    console.log('✅ Order updated:', orderId, status);
    return true;
  } catch (err) {
    console.error('❌ Failed to update order:', err);
    throw err;
  }
}

// ── TECHNICIAN LOCATION ───────────────────────────────────────────────────
export function listenTechLocation(callback) {
  const locRef = ref(db, 'techLocation');
  const listener = onValue(locRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  });
  return () => off(locRef, 'value', listener);
}

export function listenTechLocationByPhone(techPhone, callback, orderId) {
  if (!techPhone || !orderId) {
    callback(null);
    return () => {};
  }
  const locRef = ref(db, 'orders/' + orderId + '/techLocation');
  const listener = onValue(locRef, (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      callback({ lat: val.lat, lng: val.lng });
    } else {
      callback(null);
    }
  });
  return () => off(locRef, 'value', listener);
}

// ── TECHNICIAN DATA ───────────────────────────────────────────────────────
export function listenTechnicians(callback) {
  const load = async () => {
    const all = [];
    const usersSnap = await get(ref(db, 'techUsers'));
    if (usersSnap.exists()) {
      usersSnap.forEach(child => {
        all.push({ phone: child.key, ...child.val(), source: 'techUsers' });
      });
    }
    const legacySnap = await get(ref(db, 'techs'));
    if (legacySnap.exists()) {
      const existingPhones = new Set(all.map(t => t.phone));
      legacySnap.forEach(child => {
        if (!existingPhones.has(child.key)) {
          all.push({ phone: child.key, ...child.val(), source: 'techs' });
        }
      });
    }
    callback(all);
  };
  load();
  const unsub1 = onValue(ref(db, 'techUsers'), () => load());
  const unsub2 = onValue(ref(db, 'techs'), () => load());
  return () => { unsub1(); unsub2(); };
}

export function listenTechsOnline(callback) {
  const ref_ = ref(db, 'techsOnline');
  const listener = onValue(ref_, (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const techs = [];
    snapshot.forEach(child => {
      techs.push({ phone: child.key, ...child.val() });
    });
    callback(techs);
  });
  return () => off(ref_, 'value', listener);
}

// ── STATS ─────────────────────────────────────────────────────────────────
export async function getOrderStats() {
  const snap = await get(ref(db, 'orders'));
  if (!snap.exists()) {
    return { total: 0, pending: 0, accepted: 0, completed: 0, rejected: 0 };
  }
  let total = 0, pending = 0, accepted = 0, completed = 0, rejected = 0;
  snap.forEach(child => {
    total++;
    const s = child.val().status;
    if (s === 'pending') pending++;
    else if (s === 'accepted') accepted++;
    else if (s === 'completed') completed++;
    else if (s === 'rejected') rejected++;
  });
  return { total, pending, accepted, completed, rejected };
}

export async function getTechCount() {
  let count = 0;
  const usersSnap = await get(ref(db, 'techUsers'));
  if (usersSnap.exists()) count += usersSnap.size || Object.keys(usersSnap.val()).length;
  const legacySnap = await get(ref(db, 'techs'));
  if (legacySnap.exists()) {
    const existingPhones = usersSnap.exists() ? Object.keys(usersSnap.val()) : [];
    legacySnap.forEach(child => {
      if (!existingPhones.includes(child.key)) count++;
    });
  }
  return count;
}

// ── DISTANCE ──────────────────────────────────────────────────────────────
export function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
}

// ── RATINGS & REVIEWS ─────────────────────────────────────────────────────
export async function getTechRating(techPhone) {
  if (!techPhone) return null;
  try {
    const ratingSnap = await get(ref(db, 'techRatings/' + techPhone));
    if (ratingSnap.exists()) {
      const data = ratingSnap.val();
      return {
        average: data.average || data.avg || 0,
        count: data.count || 0,
        totalRating: data.totalRating || 0,
      };
    }
    const cleanPhone = techPhone.replace('+91', '').replace(/^0+/, '');
    const reviewsSnap = await get(ref(db, 'reviews'));
    if (reviewsSnap.exists()) {
      let totalRating = 0;
      let count = 0;
      reviewsSnap.forEach(child => {
        const review = child.val();
        if (!review.techPhone) return;
        const reviewClean = review.techPhone.replace('+91', '').replace(/^0+/, '');
        if (review.techPhone === techPhone || reviewClean === cleanPhone) {
          totalRating += (review.rating || 0);
          count++;
        }
      });
      if (count > 0) {
        return { average: Math.round((totalRating / count) * 10) / 10, count, totalRating };
      }
    }
    return null;
  } catch (err) {
    console.error('❌ Failed to get tech rating:', err);
    return null;
  }
}

export async function submitTechReview(techPhone, techName, customerName, rating, comment = '', orderId = null, customerPhone = '') {
  try {
    const reviewId = Date.now().toString();
    await set(ref(db, 'reviews/' + reviewId), {
      techPhone, techName, customerName, customerPhone, orderId, rating, comment,
      time: new Date().toLocaleString(), timestamp: Date.now(),
    });
    if (orderId) {
      try { await update(ref(db, 'orders/' + orderId), { reviewed: true }); } catch(e) {}
    }
    if (techPhone) {
      try {
        const existingSnap = await get(ref(db, 'techRatings/' + techPhone));
        let totalRating = rating;
        let count = 1;
        if (existingSnap.exists()) {
          const existing = existingSnap.val();
          totalRating = (existing.totalRating || 0) + rating;
          count = (existing.count || 0) + 1;
        }
        await set(ref(db, 'techRatings/' + techPhone), {
          average: Math.round((totalRating / count) * 10) / 10, count, totalRating,
          lastUpdated: Date.now(),
        });
      } catch(e) {}
    }
    return true;
  } catch (err) {
    console.error('❌ Failed to save review:', err);
    throw err;
  }
}

export async function getTechReviews(techPhone) {
  if (!techPhone) return [];
  try {
    const reviewsSnap = await get(ref(db, 'reviews'));
    if (!reviewsSnap.exists()) return [];
    const cleanPhone = techPhone.replace('+91', '').replace(/^0+/, '');
    const reviews = [];
    reviewsSnap.forEach(child => {
      const review = child.val();
      if (!review.techPhone) return;
      const reviewClean = review.techPhone.replace('+91', '').replace(/^0+/, '');
      if (review.techPhone === techPhone || reviewClean === cleanPhone) {
        reviews.push({ id: child.key, ...review });
      }
    });
    return reviews.reverse();
  } catch (err) {
    return [];
  }
}

// ── TECH PROFILE ──────────────────────────────────────────────────────────
export async function getTechProfile(techPhone) {
  if (!techPhone) return null;
  try {
    const cleanPhone = techPhone.replace('+91', '').replace(/^0+/, '');
    let userSnap = await get(ref(db, 'techUsers/' + cleanPhone));
    if (!userSnap.exists()) {
      userSnap = await get(ref(db, 'techs/' + cleanPhone));
    }
    const profile = {
      name: 'Technician', phone: cleanPhone, location: '', pincode: '', experience: '',
      skills: [], photo: null, aadharVerified: false, certificateUploaded: false,
      verifiedBadge: false, memberSince: null,
    };
    if (userSnap.exists()) {
      const data = userSnap.val();
      profile.name = data.name || 'Technician';
      profile.location = data.location || '';
      profile.pincode = data.pincode || '';
      profile.experience = data.exp || data.experience || '';
      profile.skills = data.skills || data.selSkills || [];
      profile.photo = data.photo || null;
    }
    try {
      const aadharSnap = await get(ref(db, 'techVerification/' + cleanPhone + '/aadhar'));
      if (aadharSnap.exists()) profile.aadharVerified = aadharSnap.val().verified === true;
    } catch(_) {}
    try {
      const certSnap = await get(ref(db, 'techVerification/' + cleanPhone + '/certificate'));
      if (certSnap.exists()) profile.certificateUploaded = certSnap.val().uploaded === true;
    } catch(_) {}
    try {
      const badgeSnap = await get(ref(db, 'techVerification/' + cleanPhone + '/verifiedBadge'));
      if (badgeSnap.exists()) profile.verifiedBadge = badgeSnap.val() === true;
    } catch(_) {}
    try {
      const memberSnap = await get(ref(db, 'techVerification/' + cleanPhone + '/memberSince'));
      if (memberSnap.exists()) profile.memberSince = memberSnap.val();
    } catch(_) {}
    if (!profile.aadharVerified) {
      try {
        const legacySnap = await get(ref(db, 'techUsers/' + cleanPhone + '/aadharVerified'));
        if (legacySnap.exists()) profile.aadharVerified = legacySnap.val() === true;
      } catch(_) {}
    }
    return profile;
  } catch (err) {
    console.error('❌ Failed to get tech profile:', err);
    return null;
  }
}

export function listenTechPhoto(techPhone, callback) {
  if (!techPhone) { callback(null); return () => {}; }
  const cleanPhone = techPhone.replace('+91', '').replace(/^0+/, '');
  const photoRef = ref(db, 'techUsers/' + cleanPhone + '/photo');
  const listener = onValue(photoRef, (snapshot) => {
    if (snapshot.exists() && typeof snapshot.val() === 'string' && snapshot.val().startsWith('http')) {
      callback(snapshot.val());
    } else { callback(null); }
  }, (err) => {
    console.log('techPhoto listener error:', err.message);
    callback(null);
  });
  return () => off(photoRef, 'value', listener);
}

// ── USER PROFILE ──────────────────────────────────────────────────────────
export async function saveUserProfile(phone, data) {
  try {
    await set(ref(db, 'users/' + phone), { ...data, phone, updatedAt: Date.now(), createdAt: Date.now() });
    return true;
  } catch (err) {
    console.error('❌ Failed to save user profile:', err);
    throw err;
  }
}

export async function getUserProfile(phone) {
  try {
    const snap = await get(ref(db, 'users/' + phone));
    return snap.exists() ? snap.val() : null;
  } catch (err) {
    return null;
  }
}

// ── CHAT SYSTEM ─────────────────────────────────────────────────────────────
export async function sendMessage(orderId, messageData) {
  try {
    const msgRef = push(ref(db, 'chats/' + orderId + '/messages'));
    const message = {
      ...messageData,
      timestamp: Date.now(),
      read: false,
      readAt: null,
    };
    await set(msgRef, message);
    await update(ref(db, 'chats/' + orderId + '/metadata'), {
      lastMessage: messageData.text || '',
      lastSender: messageData.senderRole || messageData.sender || '',
      lastTime: Date.now(),
      unread: true,
    });
    return { messageId: msgRef.key };
  } catch (err) {
    console.error('❌ Failed to send message:', err);
    throw err;
  }
}

export function listenMessages(orderId, callback) {
  const messagesRef = ref(db, 'chats/' + orderId + '/messages');
  const listener = onValue(messagesRef, (snapshot) => {
    if (!snapshot.exists()) { callback([]); return; }
    const messages = [];
    snapshot.forEach(child => {
      messages.push({ id: child.key, ...child.val() });
    });
    callback(messages);
  });
  return () => off(messagesRef, 'value', listener);
}

export function listenChatMetadata(orderId, callback) {
  const metaRef = ref(db, 'chats/' + orderId + '/metadata');
  const listener = onValue(metaRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  });
  return () => off(metaRef, 'value', listener);
}

// Mark messages as read
export async function markChatRead(orderId, role) {
  if (!orderId) return;
  try {
    const msgsSnap = await get(ref(db, 'chats/' + orderId + '/messages'));
    if (msgsSnap.exists()) {
      const updates = {};
      msgsSnap.forEach(child => {
        const msg = child.val();
        if (!msg.read && msg.senderRole !== role) {
          updates['chats/' + orderId + '/messages/' + child.key + '/read'] = true;
          updates['chats/' + orderId + '/messages/' + child.key + '/readAt'] = Date.now();
        }
      });
      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
      }
    }
    // Clear unread metadata
    await update(ref(db, 'chats/' + orderId + '/metadata'), { unread: false });
  } catch (err) {
    console.error('❌ Failed to mark chat read:', err);
  }
}

// ── AADHAR / DIGILOCKER ──────────────────────────────────────────────────
export async function saveAadharVerification(phone, data) {
  try {
    await set(ref(db, 'users/' + phone + '/aadhar'), {
      verified: true, name: data.name || '', lastFourDigits: data.lastFourDigits || '',
      verifiedAt: Date.now(), ...data,
    });
    return true;
  } catch (err) { throw err; }
}

export async function getAadharStatus(phone) {
  try {
    const snap = await get(ref(db, 'users/' + phone + '/aadhar'));
    return snap.exists() ? snap.val() : null;
  } catch (err) { return null; }
}

export {
  db,
  ref,
  push,
  set,
  update,
  onValue,
  get,
  query,
  orderByChild,
  equalTo,
  PHONE_BRANDS,
  LAPTOP_BRANDS,
  TV_BRANDS,
  AC_BRANDS,
  FRIDGE_BRANDS,
  WM_BRANDS,
  SERVICE_CATEGORIES,
  SERVICE_BRANDS,
  TIME_SLOTS,
  MONTHS,
  DAYS,
};
