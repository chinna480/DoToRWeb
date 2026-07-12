// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDGzlU-qp5Q_ht8xxIrpyeGNPLgbbKexKs",
  authDomain: "dotor-2e4d8.firebaseapp.com",
  databaseURL: "https://dotor-2e4d8-default-rtdb.firebaseio.com",
  projectId: "dotor-2e4d8",
  storageBucket: "dotor-2e4d8.firebasestorage.app",
  messagingSenderId: "984437487718",
  appId: "1:984437487718:web:3d279fdf6e720f119915a7"
});

const messaging = firebase.messaging();

// Activate service worker immediately
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

messaging.onBackgroundMessage((payload) => {
  console.log('Background message:', payload);
  const notificationTitle = payload.notification?.title || 'DoToR';
  const notificationBody = payload.notification?.body || '';
  const notificationData = payload.data || {};

  self.registration.showNotification(notificationTitle, {
    body: notificationBody,
    icon: '/logo.jpeg',
    badge: '/logo.jpeg',
    data: notificationData
  });
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  notification.close();

  const data = notification.data || {};
  const urlToOpen = data.screen
    ? (self.location.origin + '/#' + data.screen)
    : self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
