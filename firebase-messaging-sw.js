// Firebase Cloud Messaging service worker
// This file needs to be at the root to satisfy scope requirements
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// The service worker cannot import ES modules easily across all browsers; use compat here.
// IMPORTANT: These values will be populated at runtime by your app; alternatively embed your config here.
// If you prefer, you can inline your firebaseConfig here like below.
// Initialize here if not injected dynamically
// Replace placeholders with your actual config if you prefer static SW config
self.firebase.initializeApp({
  apiKey: "AIzaSyBvgrlGIAyZwXqK7ErIW5heJjPes-8yVPs",
  authDomain: "fledd-2e273.firebaseapp.com",
  projectId: "fledd-2e273",
  storageBucket: "fledd-2e273.appspot.com",
  messagingSenderId: "788493358840",
  appId: "1:788493358840:web:9b234acb2876447de4cd0d"
});

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (e) {
  // no-op
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
