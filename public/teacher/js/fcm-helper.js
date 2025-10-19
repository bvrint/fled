/**
 * FCM Helper - Manages FCM token registration for web push notifications
 */

import { messaging, vapidKey } from './firebase.js';
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js";
import { doc, setDoc, arrayUnion, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { db, auth } from './firebase.js';

/**
 * Request notification permission and save FCM token to Firestore
 * @returns {Promise<string|null>} FCM token or null if failed
 */
export async function registerFCMToken() {
  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return null;
    }

    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers are not supported');
      return null;
    }

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Get current user
    const user = auth.currentUser;
    if (!user) {
      console.error('No authenticated user');
      return null;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('Service Worker registered');

    // Get FCM token
    const token = await getToken(messaging, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: registration
    });

    if (token) {
      console.log('FCM Token obtained:', token.substring(0, 20) + '...');
      
      // Save token to Firestore user document
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        fcmTokens: arrayUnion({
          token: token,
          device: getBrowserInfo(),
          addedAt: new Date().toISOString()
        }),
        lastTokenUpdate: serverTimestamp()
      }, { merge: true });

      console.log('FCM token saved to Firestore');
      return token;
    } else {
      console.warn('No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('Error registering FCM token:', error);
    return null;
  }
}

/**
 * Get browser information for device identification
 * @returns {string} Browser and OS info
 */
function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edge')) browser = 'Edge';
  
  const os = ua.includes('Windows') ? 'Windows' 
    : ua.includes('Mac') ? 'Mac' 
    : ua.includes('Linux') ? 'Linux' 
    : 'Unknown';
  
  return `${browser} on ${os}`;
}

/**
 * Setup foreground message listener
 * Shows notification when app is in foreground
 */
export function setupMessageListener() {
  onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    
    const notificationTitle = payload.notification?.title || 'New Message';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: payload.notification?.icon || '/assets/img/logo.png',
      badge: '/assets/img/favicon.png',
      data: payload.data
    };

    // Show notification using Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notificationTitle, notificationOptions);
    }
  });
}
