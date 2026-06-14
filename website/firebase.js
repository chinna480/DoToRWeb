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
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

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

// ── Order fields matching the mobile app exactly ─────────────────────────
// When booking, we create the same order structure as HomeScreen.js
const PHONE_BRANDS  = ['iPhone','Samsung','OnePlus','Redmi','Vivo','Oppo','Realme','Nokia'];
const LAPTOP_BRANDS = ['Dell','HP','Lenovo','MacBook','Asus','Acer','MSI','Sony'];

const TIME_SLOTS = [
  '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00',
  '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00',
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Create a new repair order (same format as mobile app HomeScreen.js) ───
export async function createOrder(orderData) {
  try {
    const orderRef = push(ref(db, 'orders'));
    const orderId = orderRef.key;

    const order = {
      customerName:  orderData.name,
      customerPhone: orderData.phone,
      location:      orderData.location || '',
      pincode:       orderData.pincode || '',
      device:        orderData.device || '',
      brand:         orderData.brand,
      modelName:     orderData.modelName || orderData.model || '',
      description:   (orderData.description || '').trim(),
      status:        'pending',
      time:          orderData.time || new Date().toLocaleTimeString(),
      custLat:       orderData.lat || null,
      custLng:       orderData.lng || null,
      images:        orderData.images || [],
      ...(orderData.isAppointment && {
        isAppointment: true,
        appointmentTime: orderData.appointmentTime,
        date: orderData.date,
        dateLabel: orderData.dateLabel,
        timeSlot: orderData.timeSlot,
        reminderSent: false,
      }),
    };

    await set(ref(db, 'orders/' + orderId), order);
    console.log('✅ Order created:', orderId);
    return { orderId, order };
  } catch (err) {
    console.error('❌ Failed to create order:', err);
    throw err;
  }
}

// ── Get all orders (with optional filter) ────────────────────────────────
export function listenOrders(callback) {
  const ordersRef = ref(db, 'orders');
  const listener = onValue(ordersRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const orders = [];
    snapshot.forEach(child => {
      const val = child.val();
      const order = { id: child.key, ...val };
      // Normalize images (Firebase stores arrays as objects)
      if (order.images && !Array.isArray(order.images)) {
        order.images = Object.values(order.images);
      }
      orders.push(order);
    });
    callback(orders.reverse());
  });
  return () => off(ordersRef, 'value', listener);
}

// ── Get orders for a specific customer ───────────────────────────────────
export function listenCustomerOrders(phone, callback) {
  const ordersRef = ref(db, 'orders');
  const listener = onValue(ordersRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const orders = [];
    snapshot.forEach(child => {
      const val = child.val();
      if (val.customerPhone === phone) {
        const order = { id: child.key, ...val };
        if (order.images && !Array.isArray(order.images)) {
          order.images = Object.values(order.images);
        }
        orders.push(order);
      }
    });
    callback(orders.reverse());
  });
  return () => off(ordersRef, 'value', listener);
}

// ── Listen to a single order (for tracking) ──────────────────────────────
export function listenOrder(orderId, callback) {
  const orderRef = ref(db, 'orders/' + orderId);
  const listener = onValue(orderRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    const val = snapshot.val();
    const order = { id: orderId, ...val };
    if (order.images && !Array.isArray(order.images)) {
      order.images = Object.values(order.images);
    }
    callback(order);
  });
  return () => off(orderRef, 'value', listener);
}

// ── Update order status ──────────────────────────────────────────────────
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

// ── Listen to technician location (for customer tracking) ────────────────
// ⚠️  Uses a GLOBAL path — can be overwritten by other active techs.
// Prefer listenTechLocationByPhone() for per-tech accuracy.
export function listenTechLocation(callback) {
  const locRef = ref(db, 'techLocation');
  const listener = onValue(locRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  });
  return () => off(locRef, 'value', listener);
}

// ── Listen to a SPECIFIC technician's location (per-tech tracking) ──────
// Reads from techsOnline/{techPhone} which the mobile app updates every ~4s.
// This avoids the collision issue with the global techLocation path.
export function listenTechLocationByPhone(techPhone, callback) {
  if (!techPhone) {
    callback(null);
    return () => {};
  }
  const cleanPhone = techPhone.replace('+91', '').replace(/^0+/, '');
  const locRef = ref(db, 'techsOnline/' + cleanPhone);
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

// ── Get all registered technicians ───────────────────────────────────────
export function listenTechnicians(callback) {
  // Try techUsers first, then techs
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
  // Also listen for real-time updates
  const unsub1 = onValue(ref(db, 'techUsers'), () => load());
  const unsub2 = onValue(ref(db, 'techs'), () => load());
  return () => { unsub1(); unsub2(); };
}

// ── Listen to techsOnline (currently active techs with GPS) ─────────────
export function listenTechsOnline(callback) {
  const ref_ = ref(db, 'techsOnline');
  const listener = onValue(ref_, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const techs = [];
    snapshot.forEach(child => {
      techs.push({ phone: child.key, ...child.val() });
    });
    callback(techs);
  });
  return () => off(ref_, 'value', listener);
}

// ── Get order counts (for admin dashboard) ───────────────────────────────
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

// ── Get technician count ─────────────────────────────────────────────────
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

// ── Distance calculation (same as mobile app) ────────────────────────────
export function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
}

// ── Get technician rating from past reviews ────────────────────────────────
// Returns { average, count, totalRating } or null if no ratings found
// Reads from techRatings/{techPhone} path, with fallback to computing from reviews
export async function getTechRating(techPhone) {
  if (!techPhone) return null;

  try {
    // First try dedicated ratings path (pre-computed averages)
    const ratingSnap = await get(ref(db, 'techRatings/' + techPhone));
    if (ratingSnap.exists()) {
      const data = ratingSnap.val();
      return {
        average: data.average || data.avg || 0,
        count: data.count || 0,
        totalRating: data.totalRating || 0,
      };
    }

    // Fallback: scan reviews and try to match by tech phone
    // Handles both +91 and non-+91 formats in both directions
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
        return {
          average: Math.round((totalRating / count) * 10) / 10,
          count,
          totalRating,
        };
      }
    }

    return null;
  } catch (err) {
    console.error('❌ Failed to get tech rating:', err);
    return null;
  }
}

// ── Save a review for a technician (from website) ─────────────────────────
export async function submitTechReview(techPhone, techName, customerName, rating, comment = '') {
  try {
    const reviewId = Date.now().toString();
    await set(ref(db, 'reviews/' + reviewId), {
      techPhone,
      techName,
      customerName,
      rating,
      comment,
      time: new Date().toLocaleString(),
      timestamp: Date.now(),
    });

    // Also update the aggregated ratings path
    const existingSnap = await get(ref(db, 'techRatings/' + techPhone));
    let totalRating = rating;
    let count = 1;

    if (existingSnap.exists()) {
      const existing = existingSnap.val();
      totalRating = (existing.totalRating || 0) + rating;
      count = (existing.count || 0) + 1;
    }

    await set(ref(db, 'techRatings/' + techPhone), {
      average: Math.round((totalRating / count) * 10) / 10,
      count,
      totalRating,
      lastUpdated: Date.now(),
    });

    console.log('✅ Review saved for tech:', techPhone);
    return true;
  } catch (err) {
    console.error('❌ Failed to save review:', err);
    throw err;
  }
}

// ── Get all reviews for a technician ───────────────────────────────────────
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
    console.error('❌ Failed to get tech reviews:', err);
    return [];
  }
}

// ── Get technician profile (photo, experience, verification status) ───────
// Reads from techUsers/{techPhone} which stores: name, phone, location, pincode
// Additionally checks for verification data in dedicated verification paths
export async function getTechProfile(techPhone) {
  if (!techPhone) return null;

  try {
    const cleanPhone = techPhone.replace('+91', '').replace(/^0+/, '');

    // Primary: techUsers path
    let userSnap = await get(ref(db, 'techUsers/' + cleanPhone));
    if (!userSnap.exists()) {
      userSnap = await get(ref(db, 'techs/' + cleanPhone));
    }

    const profile = {
      name: 'Technician',
      phone: cleanPhone,
      location: '',
      pincode: '',
      experience: '',
      skills: [],
      photo: null,
      aadharVerified: false,
      certificateUploaded: false,
      verifiedBadge: false,
      memberSince: null,
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

    // Check for Aadhar verification status
    const aadharSnap = await get(ref(db, 'techVerification/' + cleanPhone + '/aadhar'));
    if (aadharSnap.exists()) {
      profile.aadharVerified = aadharSnap.val().verified === true;
    }

    // Check for certificate upload
    const certSnap = await get(ref(db, 'techVerification/' + cleanPhone + '/certificate'));
    if (certSnap.exists()) {
      profile.certificateUploaded = certSnap.val().uploaded === true;
    }

    // Check for verified badge (admin-approved)
    const badgeSnap = await get(ref(db, 'techVerification/' + cleanPhone + '/verifiedBadge'));
    if (badgeSnap.exists()) {
      profile.verifiedBadge = badgeSnap.val() === true;
    }

    // Check member since
    const memberSnap = await get(ref(db, 'techVerification/' + cleanPhone + '/memberSince'));
    if (memberSnap.exists()) {
      profile.memberSince = memberSnap.val();
    }

    // If Aadhar is stored in legacy format (AsyncStorage-only), check techVerification
    if (!profile.aadharVerified) {
      const legacySnap = await get(ref(db, 'techUsers/' + cleanPhone + '/aadharVerified'));
      if (legacySnap.exists()) {
        profile.aadharVerified = legacySnap.val() === true;
      }
    }

    return profile;
  } catch (err) {
    console.error('❌ Failed to get tech profile:', err);
    return null;
  }
}

// ── CUSTOMER PROFILE MANAGEMENT ────────────────────────────────────────────
export async function saveUserProfile(phone, data) {
  try {
    await set(ref(db, 'users/' + phone), {
      ...data,
      phone,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    });
    console.log('✅ User profile saved:', phone);
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
    console.error('❌ Failed to get user profile:', err);
    return null;
  }
}

// ── CHAT SYSTEM ─────────────────────────────────────────────────────────────
// Messages stored at chats/{orderId}/messages/{messageId}
// Metadata stored at chats/{orderId}/metadata
export async function sendMessage(orderId, messageData) {
  try {
    const msgRef = push(ref(db, 'chats/' + orderId + '/messages'));
    const message = {
      ...messageData,
      timestamp: Date.now(),
      read: false,
    };
    await set(msgRef, message);

    // Update metadata
    await update(ref(db, 'chats/' + orderId + '/metadata'), {
      lastMessage: messageData.text || '',
      lastSender: messageData.sender,
      lastTimestamp: Date.now(),
      unread: true,
    });

    console.log('✅ Message sent:', msgRef.key);
    return { messageId: msgRef.key };
  } catch (err) {
    console.error('❌ Failed to send message:', err);
    throw err;
  }
}

export function listenMessages(orderId, callback) {
  const messagesRef = ref(db, 'chats/' + orderId + '/messages');
  const listener = onValue(messagesRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
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

// ── AADHAR / DIGILOCKER VERIFICATION ────────────────────────────────────────
export async function saveAadharVerification(phone, data) {
  try {
    await set(ref(db, 'users/' + phone + '/aadhar'), {
      verified: true,
      name: data.name || '',
      lastFourDigits: data.lastFourDigits || '',
      verifiedAt: Date.now(),
      ...data,
    });
    console.log('✅ Aadhar verification saved for:', phone);
    return true;
  } catch (err) {
    console.error('❌ Failed to save Aadhar verification:', err);
    throw err;
  }
}

export async function getAadharStatus(phone) {
  try {
    const snap = await get(ref(db, 'users/' + phone + '/aadhar'));
    return snap.exists() ? snap.val() : null;
  } catch (err) {
    console.error('❌ Failed to get Aadhar status:', err);
    return null;
  }
}

export {
  db,
  ref,
  push,
  set,
  update,
  get,
  PHONE_BRANDS,
  LAPTOP_BRANDS,
  TIME_SLOTS,
  MONTHS,
  DAYS,
};
