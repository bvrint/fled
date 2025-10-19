# FLED FCM Notification System - Setup & Testing Guide

## Overview
This guide will help you set up and test the complete FCM (Firebase Cloud Messaging) notification system for FLED. The system consists of:
- **Web Client**: Saves FCM tokens when teachers log in
- **Notify Server**: Node.js server that sends push notifications via Firebase Admin SDK
- **Firebase Console**: Manage VAPID keys and service account

## Prerequisites
- ✅ Firebase project created (fledd-2e273)
- ✅ Service account JSON downloaded
- ✅ Google OAuth configured
- ⏳ VAPID key (we'll generate this)

---

## Step 1: Get Your VAPID Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **fledd-2e273**
3. Click the gear icon ⚙️ > **Project settings**
4. Navigate to the **Cloud Messaging** tab
5. Scroll to **Web configuration** section
6. Under **Web Push certificates**, click **Generate key pair** (if not already generated)
7. Copy the **Key pair** value (starts with `B...`)

8. Open `/Users/jhonrussellrodriguez/Downloads/wFled copy 5/public/teacher/js/firebase.js`
9. Replace `YOUR_VAPID_KEY_HERE` with your actual VAPID key:
   ```javascript
   export const vapidKey = "BAnB...your-actual-key";
   ```

---

## Step 2: Setup Notify Server

### Install Dependencies

```bash
cd "/Users/jhonrussellrodriguez/Downloads/wFled copy 5/notify-server"
npm install
```

### Configure Service Account

1. Make sure you have downloaded your service account JSON file from Firebase Console
   - Go to **Project Settings** > **Service Accounts**
   - Click **Generate new private key**
   - Save the file as `service-account.json`

2. Copy the service account file to the notify-server directory:
   ```bash
   cp ~/Downloads/fledd-2e273-firebase-adminsdk-*.json "./service-account.json"
   ```

3. Set environment variable (Mac/Linux):
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/service-account.json"
   ```

   Or add it to your shell profile (~/.zshrc or ~/.bash_profile):
   ```bash
   echo 'export GOOGLE_APPLICATION_CREDENTIALS="/Users/jhonrussellrodriguez/Downloads/wFled copy 5/notify-server/service-account.json"' >> ~/.zshrc
   source ~/.zshrc
   ```

---

## Step 3: Start the Notify Server

```bash
cd "/Users/jhonrussellrodriguez/Downloads/wFled copy 5/notify-server"
npm start
```

You should see:
```
✓ Firebase Admin initialized
🚀 Notify server running on http://localhost:3001
```

Keep this terminal open!

---

## Step 4: Deploy Web App to Firebase Hosting

```bash
cd "/Users/jhonrussellrodriguez/Downloads/wFled copy 5"
firebase deploy --only hosting
```

After deployment, your site will be at: https://fledd-2e273.web.app

**Note:** FCM requires HTTPS, so test on the deployed site, not localhost.

---

## Step 5: Test FCM Token Registration

1. Open your deployed site: https://fledd-2e273.web.app/teacher/login.html
2. Open browser **Developer Tools** (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Click **Sign in with Google**
5. After successful login, look for these console messages:
   ```
   Service Worker registered
   FCM Token obtained: e7Qx...
   FCM token saved to Firestore
   ```

6. Verify in Firestore:
   - Go to Firebase Console > **Firestore Database**
   - Find your user document in the `users` collection
   - Check for `fcmTokens` array with token object:
     ```javascript
     {
       token: "e7Qx...",
       device: "Chrome on Mac",
       addedAt: "2024-01-..."
     }
     ```

**Troubleshooting:**
- If you see "Notification permission denied", click the 🔒 lock icon in the address bar > Site settings > Allow notifications
- If service worker fails, ensure `firebase-messaging-sw.js` is in the `/public` folder
- Check browser console for any errors

---

## Step 6: Test Notification Sending

### Option A: Using curl (command line)

First, get a valid Firebase ID token:
1. In browser console (on your deployed site), run:
   ```javascript
   firebase.auth().currentUser.getIdToken().then(token => console.log(token))
   ```
2. Copy the long token string

Then send a test notification:
```bash
curl -X POST http://localhost:3001/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN_HERE" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test from notify server!",
    "studentIds": ["STUDENT_ID_HERE"]
  }'
```

### Option B: Create a test student and parent

1. In Firebase Console > Firestore, create test documents:

**students collection:**
```javascript
{
  id: "test-student-001",
  name: "Test Student",
  parentPhone: "+1234567890",
  teacherUid: "YOUR_TEACHER_UID"
}
```

**users collection (parent):**
```javascript
{
  uid: "parent-uid-001",
  phone: "+1234567890",
  role: "parent",
  fcmTokens: [
    {
      token: "COPY_YOUR_FCM_TOKEN_HERE",
      device: "Chrome on Mac",
      addedAt: "2024-01-..."
    }
  ]
}
```

2. Now send notification:
```bash
curl -X POST http://localhost:3001/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN_HERE" \
  -d '{
    "title": "Student Update",
    "body": "Test Student has been marked present",
    "studentIds": ["test-student-001"]
  }'
```

### Expected Response:
```json
{
  "success": true,
  "stats": {
    "totalTokens": 1,
    "successful": 1,
    "failed": 0
  },
  "invalidTokens": []
}
```

---

## Step 7: Integration with Dashboard Features

### Send notifications when marking attendance:

In `/public/teacher/js/attendance.js`, after saving attendance:

```javascript
async function markAttendance(sessionId, studentId, status) {
  // ... existing code to save attendance ...
  
  // Send notification to parent
  try {
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('http://localhost:3001/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        title: 'Attendance Update',
        body: `Your child has been marked ${status}`,
        studentIds: [studentId]
      })
    });
    
    if (!response.ok) {
      console.error('Notification failed:', await response.text());
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}
```

### Send notifications when creating tasks:

In `/public/teacher/js/tasks.js`, after creating a task:

```javascript
async function createTask(taskData) {
  // ... existing code to save task ...
  
  // Send notification to all parents
  const studentIds = taskData.assignedTo; // Array of student IDs
  
  try {
    const idToken = await auth.currentUser.getIdToken();
    await fetch('http://localhost:3001/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        title: 'New Task Assigned',
        body: taskData.title,
        studentIds: studentIds
      })
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}
```

---

## Step 8: Production Deployment

### Deploy Notify Server to Cloud Run (Free Tier)

1. Install Google Cloud CLI:
   ```bash
   brew install google-cloud-sdk
   ```

2. Login and set project:
   ```bash
   gcloud auth login
   gcloud config set project fledd-2e273
   ```

3. Create Dockerfile in notify-server directory:
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 3001
   CMD ["node", "notify-server.js"]
   ```

4. Deploy to Cloud Run:
   ```bash
   cd notify-server
   gcloud run deploy fled-notify-server \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json
   ```

5. Update your dashboard code to use the Cloud Run URL:
   ```javascript
   const NOTIFY_URL = 'https://fled-notify-server-xxx.run.app/notify';
   ```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Teacher Dashboard (Web)                  │
│  1. Teacher logs in → FCM token saved to Firestore          │
│  2. Teacher marks attendance/creates task                    │
│  3. Dashboard calls /notify endpoint with student IDs        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Notify Server (Node.js)                  │
│  4. Verify Firebase ID token                                 │
│  5. Resolve student IDs → parent phone → user FCM tokens     │
│  6. Send FCM notifications via Admin SDK                     │
│  7. Clean up invalid tokens                                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Firebase Cloud Messaging (FCM)                 │
│  8. Deliver push notification to parent devices              │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Parent Mobile App (Flutter)                │
│  9. Receive and display notification                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Notification not received?
- ✅ Check browser notification permissions are granted
- ✅ Ensure VAPID key is correct in firebase.js
- ✅ Verify FCM token is saved in Firestore users collection
- ✅ Check notify server logs for errors
- ✅ Confirm service worker is registered (check Application tab in DevTools)

### Service worker not loading?
- ✅ File must be at `/public/firebase-messaging-sw.js`
- ✅ Must be served over HTTPS (use Firebase Hosting, not localhost)
- ✅ Clear browser cache and refresh

### Token verification failed?
- ✅ Get a fresh ID token: `firebase.auth().currentUser.getIdToken(true)`
- ✅ Ensure service account JSON is correctly loaded
- ✅ Check GOOGLE_APPLICATION_CREDENTIALS environment variable

### CORS errors?
- ✅ Notify server has CORS enabled for all origins (for development)
- ✅ For production, restrict to your domain in notify-server.js

---

## Cost Analysis

**Completely FREE for typical usage:**
- ✅ FCM: First 10 million messages/month FREE
- ✅ Firebase Admin SDK: FREE
- ✅ Firestore: Free tier (50K reads, 20K writes per day)
- ✅ Firebase Hosting: 10GB storage, 360MB/day transfer FREE
- ✅ Cloud Run: 2 million requests/month FREE (if using Cloud Run)
- ✅ Authentication: FREE

**You only pay if you exceed:**
- More than 10M push notifications per month
- More than 50K Firestore reads per day
- More than 10GB hosting storage

For a school system with hundreds of students, you'll stay well within free limits.

---

## Next Steps

1. ✅ Complete Step 1-6 to verify everything works
2. ⏳ Integrate notification calls into attendance.js and tasks.js
3. ⏳ Build and configure Flutter mobile app for parents
4. ⏳ Deploy notify server to Cloud Run for production
5. ⏳ Add notification preferences in user settings

---

## Security Notes

- ✅ ID tokens expire after 1 hour (automatically refreshed by Firebase)
- ✅ Service account credentials must be kept secret
- ✅ Add `.env` and `service-account.json` to `.gitignore`
- ✅ Use Firestore security rules to protect user data
- ✅ For production, restrict CORS to your domain only

---

Need help? Check the browser console and notify server logs for detailed error messages.
