// website/firebase-messaging-sw.js
// Service worker for handling Firebase Cloud Messaging push notifications in the background
// This file must be at the root of the deployed website so its scope covers all pages

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase with the same config as the main app
firebase.initializeApp({
  apiKey: 'AIzaSyDGzlU-qp5Q_ht8xxIrpyeGNPLgbbKexKs',
  authDomain: 'dotor-2e4d8.firebaseapp.com',
  databaseURL: 'https://dotor-2e4d8-default-rtdb.firebaseio.com',
  projectId: 'dotor-2e4d8',
  storageBucket: 'dotor-2e4d8.firebasestorage.app',
  messagingSenderId: '984437487718',
  appId: '1:984437487718:android:c323dd93e33ea0889915a7',
});

const messaging = firebase.messaging();

// ── Handle background push messages ─────────────────────────────────────────
// This fires when a push notification arrives while the page is NOT in focus
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'DoToR';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon-192x192.png',
    badge: '/favicon-192x192.png',
    tag: 'dotor-notification',
    renotify: true,
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [
      { action: 'open', title: 'Open DoToR' },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ── Handle notification click ───────────────────────────────────────────────
// When the user clicks on a notification, open the website
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If we already have a window tab, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
