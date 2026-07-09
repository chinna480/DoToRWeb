/**
 * Backfill old reviews with techPhone, techName, orderId
 *
 * The old ReviewScreen.js saved reviews WITHOUT techPhone/orderId, so the
 * PerformanceScreen (which filters by techPhone) can't show them.
 *
 * This script uses the Firebase Web SDK to read reviews + orders and
 * backfill old reviews with techPhone from their matching orders.
 *
 * Usage:
 *   node scripts/backfill_reviews.js
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, update, get } = require('firebase/database');

const firebaseConfig = {
  apiKey: 'AIzaSyDGzlU-qp5Q_ht8xxIrpyeGNPLgbbKexKs',
  authDomain: 'dotor-2e4d8.firebaseapp.com',
  databaseURL: 'https://dotor-2e4d8-default-rtdb.firebaseio.com',
  projectId: 'dotor-2e4d8',
  storageBucket: 'dotor-2e4d8.firebasestorage.app',
  messagingSenderId: '984437487718',
  appId: '1:984437487718:android:c323dd93e33ea0889915a7',
};

function cleanPhone(phone) {
  return (phone || '').replace('+91', '').replace(/^0+/, '');
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);

  console.log('📡 Fetching all reviews...');
  const reviewsSnap = await get(ref(db, 'reviews'));
  if (!reviewsSnap.exists()) {
    console.log('❌ No reviews found in database.');
    return;
  }
  const reviews = reviewsSnap.val();
  console.log(`📊 Found ${Object.keys(reviews).length} total reviews.`);

  console.log('📡 Fetching all orders...');
  const ordersSnap = await get(ref(db, 'orders'));
  if (!ordersSnap.exists()) {
    console.log('❌ No orders found in database.');
    return;
  }
  const orders = ordersSnap.val();

  // Build list of completed orders with techPhone
  const completedOrders = [];
  for (const [orderId, order] of Object.entries(orders)) {
    if ((order.status === 'completed' || order.reviewed === true) && order.techPhone) {
      completedOrders.push({ id: orderId, ...order });
    }
  }
  console.log(`📊 Found ${completedOrders.length} completed/reviewed orders with techPhone.`);

  let backfilled = 0;
  let skipped = 0;

  for (const [reviewId, review] of Object.entries(reviews)) {
    // Skip reviews that already have techPhone
    if (review.techPhone) {
      skipped++;
      continue;
    }

    const reviewTime = review.createdAt || review.timestamp || 0;
    const reviewName = (review.customerName || '').trim().toLowerCase();

    let match = null;

    // Fuzzy match: same customerName, timestamps within 12 hours
    const candidates = completedOrders.filter(o => {
      const oName = (o.customerName || '').trim().toLowerCase();
      const oTime = o.createdAt || 0;
      if (oName !== reviewName) return false;
      const timeDiff = Math.abs(oTime - reviewTime);
      return timeDiff < 12 * 60 * 60 * 1000;
    });

    if (candidates.length >= 1) {
      candidates.sort((a, b) => {
        return Math.abs((a.createdAt || 0) - reviewTime) - Math.abs((b.createdAt || 0) - reviewTime);
      });
      match = candidates[0];
      if (candidates.length > 1) {
        console.log(`  ⚠️ Review ${reviewId} ("${review.customerName}") had ${candidates.length} possible matches, using closest.`);
      }
    }

    if (match && match.techPhone) {
      const updateData = {
        techPhone: match.techPhone,
        techName: match.techName || '',
        orderId: match.id,
      };

      try {
        await update(ref(db, `reviews/${reviewId}`), updateData);
        console.log(`  ✅ Backfilled review ${reviewId}: customer="${review.customerName}", tech=${match.techName || match.techPhone}, order=${match.id.substring(0, 8)}...`);
        backfilled++;
      } catch (err) {
        console.error(`  ❌ Failed to update review ${reviewId}:`, err.message);
      }
    } else {
      console.log(`  ⏭️  No match for review ${reviewId} ("${review.customerName}", ${new Date(reviewTime).toLocaleString()})`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary:');
  console.log(`   Total reviews: ${Object.keys(reviews).length}`);
  console.log(`   Already had techPhone: ${skipped}`);
  console.log(`   Backfilled: ${backfilled}`);
  console.log(`   Unmatched: ${Object.keys(reviews).length - skipped - backfilled}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
