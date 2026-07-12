// Push Notifications for DoToR Web
// Uses Firebase Cloud Messaging (FCM)

const PushNotifications = {

  // Initialize FCM
  async init() {
    try {
      // Check if browser supports notifications
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return null;
      }

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return null;
      }

      // Check if Firebase messaging is available
      if (!firebase.messaging) {
        console.warn('Firebase messaging is not available');
        return null;
      }

      // Get FCM token
      const messaging = firebase.messaging();
      const token = await messaging.getToken({
        vapidKey: 'BMtEfFDinRAZlcbcJLD2HYigXvra8Ai6J8vwuBRpIUMwMaidmaKZWMcTwMKeJvk9egGTQcYfQr-QIQXRmO7WnDw'
      });

      console.log('FCM Token:', token);

      // Save token to Firebase under user's record
      const phone = Store.get('custPhone');
      if (phone && token) {
        await firebase.database().ref('users/' + phone).update({
          webPushToken: token,
          tokenUpdatedAt: Date.now()
        });
      }

      // Listen for foreground messages
      messaging.onMessage((payload) => {
        console.log('Message received:', payload);
        PushNotifications.showNotification(
          payload.notification?.title || 'DoToR',
          payload.notification?.body || '',
          payload.data
        );
      });

      return token;
    } catch (err) {
      console.error('Push notification init error:', err);
      return null;
    }
  },

  // Show notification manually (browser toast)
  showNotification(title, body, data = {}) {
    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/logo.jpeg',
          badge: '/logo.jpeg',
          data
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          if (data.screen) {
            Router.navigate(data.screen);
          }
        };
      } catch (err) {
        console.error('showNotification error:', err);
      }
    }
  },

  // ─── Customer Notification History (Firebase) ────────────

  // Write a notification to Firebase under the customer's phone
  async writeToCustomer(phone, title, body, type = 'order', data = {}) {
    if (!phone || !title) return;
    try {
      const ref = firebase.database().ref('notifications/' + phone).push();
      await ref.set({
        id: ref.key,
        title,
        body,
        type,
        data: data || {},
        createdAt: Date.now(),
        read: false
      });
      // Also show browser notification
      PushNotifications.showNotification(title, body, data);
      return ref.key;
    } catch (err) {
      console.error('writeToCustomer error:', err);
    }
  },

  // Write a notification for technicians (tech dashboards/Android app)
  async writeToTechnicians(title, body, type = 'new_order', data = {}) {
    if (!title) return;
    try {
      const ref = firebase.database().ref('notifications/tech_all').push();
      await ref.set({
        id: ref.key,
        title,
        body,
        type,
        data: data || {},
        createdAt: Date.now(),
        read: false
      });
      return ref.key;
    } catch (err) {
      console.error('writeToTechnicians error:', err);
    }
  },

  // Mark a single notification as read
  async markAsRead(phone, notifId) {
    if (!phone || !notifId) return;
    try {
      await firebase.database().ref('notifications/' + phone + '/' + notifId).update({ read: true });
    } catch (err) {
      console.error('markAsRead error:', err);
    }
  },

  // Mark all notifications as read for a user
  async markAllAsRead(phone) {
    if (!phone) return;
    try {
      const snap = await firebase.database().ref('notifications/' + phone).once('value');
      if (!snap.exists()) return;
      const updates = {};
      snap.forEach(child => {
        if (!child.val().read) {
          updates[child.key + '/read'] = true;
        }
      });
      if (Object.keys(updates).length > 0) {
        await firebase.database().ref('notifications/' + phone).update(updates);
      }
    } catch (err) {
      console.error('markAllAsRead error:', err);
    }
  },

  // Get unread count for a user (returns promise)
  async getUnreadCount(phone) {
    if (!phone) return 0;
    try {
      const snap = await firebase.database().ref('notifications/' + phone).once('value');
      if (!snap.exists()) return 0;
      let count = 0;
      snap.forEach(child => { if (!child.val().read) count++; });
      return count;
    } catch (err) {
      return 0;
    }
  },

  // ─── Send to user via FCM (requires server endpoint) ─────
  async sendToUser(phone, title, body, data = {}) {
    try {
      const snap = await firebase.database().ref('users/' + phone).once('value');
      const user = snap.val();
      if (!user?.webPushToken) return;
      await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: user.webPushToken,
          title,
          body,
          data,
          sound: 'default',
          priority: 'high'
        })
      });
    } catch (err) {
      console.error('sendToUser error:', err);
    }
  }
};
