// Client-side FCM registration helper
// Requires Firebase app to be initialized and Messaging supported in the browser.
import { getMessaging, getToken, isSupported } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { db } from './firebase.js';

// TODO: Replace with your Web Push certificate key from Firebase console (VAPID key)
const VAPID_KEY = 'BBtXMqKwy26SKHTCLwyIpLJGEwD0fBzfNeEGBsfhcYobIPUlSxzbVt-M40cWOwtDG31Y2lcG5GRMt5Whmny6Tg4';

export async function registerMessaging(user) {
  try {
    if (!user) return;
    const supported = await isSupported();
    if (!supported) return; // gracefully skip on unsupported browsers

    // Register service worker for background messages
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const messaging = getMessaging();
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
      if (token) {
        // Save token on user document for targeting notifications
        await setDoc(doc(db, 'users', user.uid), { fcmToken: token }, { merge: true });
      }
    }
  } catch (e) {
    // Non-blocking error; log to console for developers
    console.warn('FCM registration failed:', e);
  }
}
