// Firebase Cloud Messaging service worker for Hosting
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// IMPORTANT: Use the same config as your web app
self.firebase.initializeApp({
  apiKey: 'AIzaSyBvgrlGIAyZwXqK7ErIW5heJjPes-8yVPs',
  authDomain: 'fledd-2e273.firebaseapp.com',
  projectId: 'fledd-2e273',
  storageBucket: 'fledd-2e273.firebasestorage.app',
  messagingSenderId: '788493358840',
  appId: '1:788493358840:web:9b234acb2876447de4cd0d'
});

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (_e) {
  // Fallback: messaging not available
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || 'FLED';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: '/assets/img/favicon.png'
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}
