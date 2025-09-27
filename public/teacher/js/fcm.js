// Client-side FCM registration helper
// Requires Firebase app to be initialized and Messaging supported in the browser.
import { getMessaging, getToken, isSupported } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { db } from './firebase.js';

// TODO: Replace with your Web Push certificate key from Firebase console (VAPID key)
const VAPID_KEY = 'BBtXMqKwy26SKHTCLwyIpLJGEwD0fBzfNeEGBsfhcYobIPUlSxzbVt-M40cWOwtDG31Y2lcG5GRMt5Whmny6Tg4';

export async function registerMessaging(user) {
  try {
    if (!user) {
      console.log('FCM: No user provided, skipping registration');
      return;
    }

    // Check if FCM is supported
    const supported = await isSupported();
    if (!supported) {
      console.log('FCM: Not supported in this browser, skipping registration');
      return;
    }

    // Check if service worker is available
    if (!('serviceWorker' in navigator)) {
      console.log('FCM: Service Worker not supported, skipping registration');
      return;
    }

    // Check if notifications are available
    if (!('Notification' in window)) {
      console.log('FCM: Notifications not supported, skipping registration');
      return;
    }

    console.log('FCM: Starting registration process...');

    // Register service worker with error handling
    let reg;
    try {
      reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('FCM: Service worker registered successfully');
    } catch (swError) {
      console.warn('FCM: Service worker registration failed:', swError);
      // Continue without service worker registration
    }

    // Request notification permission with timeout
    const permissionPromise = Notification.requestPermission();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Permission request timeout')), 10000)
    );

    let permission;
    try {
      permission = await Promise.race([permissionPromise, timeoutPromise]);
    } catch (permError) {
      console.warn('FCM: Permission request failed or timed out:', permError);
      return;
    }

    if (permission !== 'granted') {
      console.log('FCM: Notification permission not granted:', permission);
      return;
    }

    console.log('FCM: Notification permission granted');

    // Get FCM token with error handling and timeout
    try {
      const messaging = getMessaging();
      const tokenOptions = { vapidKey: VAPID_KEY };
      
      // Only add service worker registration if it succeeded
      if (reg) {
        tokenOptions.serviceWorkerRegistration = reg;
      }

      // Add timeout for token request
      const tokenPromise = getToken(messaging, tokenOptions);
      const tokenTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Token request timeout')), 15000)
      );

      const token = await Promise.race([tokenPromise, tokenTimeoutPromise]);
      
      if (token) {
        console.log('FCM: Token obtained successfully');
        
        // Save token with error handling
        try {
          await setDoc(doc(db, 'users', user.uid), { 
            fcmToken: token,
            fcmTokenUpdated: new Date().toISOString()
          }, { merge: true });
          console.log('FCM: Token saved to database');
        } catch (saveError) {
          console.warn('FCM: Failed to save token to database:', saveError);
          // Don't throw - FCM registration can continue without saving token
        }
      } else {
        console.warn('FCM: No token received');
      }
    } catch (tokenError) {
      console.warn('FCM: Token generation failed:', tokenError);
      
      // Check for specific error types
      if (tokenError.code === 'messaging/failed-service-worker-registration') {
        console.warn('FCM: Service worker registration issue');
      } else if (tokenError.code === 'messaging/permission-blocked') {
        console.warn('FCM: Permission blocked by user or browser');
      } else if (tokenError.code === 'messaging/vapid-key-required') {
        console.warn('FCM: VAPID key configuration issue');
      } else if (tokenError.message && tokenError.message.includes('AbortError')) {
        console.warn('FCM: Registration aborted - likely due to ad blocker or browser extension');
      }
      
      // Don't rethrow - FCM failure shouldn't break the app
    }

  } catch (generalError) {
    // Catch any other unexpected errors
    console.warn('FCM: General registration error:', generalError);
    
    // Check if this might be due to browser extensions or ad blockers
    if (generalError.message && (
      generalError.message.includes('blocked') ||
      generalError.message.includes('AbortError') ||
      generalError.message.includes('NetworkError')
    )) {
      console.warn('FCM: Registration blocked - likely due to ad blocker or browser extension');
    }
  }
}
