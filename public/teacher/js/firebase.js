// Firebase configuration
// TODO: Replace placeholders with your actual project config
export const firebaseConfig = {
  apiKey: "AIzaSyBvgrlGIAyZwXqK7ErIW5heJjPes-8yVPs",
  authDomain: "fledd-2e273.firebaseapp.com",
  projectId: "fledd-2e273",
  storageBucket: "fledd-2e273.firebasestorage.app",
  messagingSenderId: "788493358840",
  appId: "1:788493358840:web:9b234acb2876447de4cd0d"
};

// VAPID key for web push (get from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates)
export const vapidKey = "BBtXMqKwy26SKHTCLwyIpLJGEwD0fBzfNeEGBsfhcYobIPUlSxzbVt-M40cWOwtDG31Y2lcG5GRMt5Whmny6Tg4";

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);