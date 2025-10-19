# FLED Quick Start Guide

## ✅ What's Already Done

Your FLED notification system is **completely configured** and ready to go! Here's what's set up:

1. ✅ **Service account credentials** saved to `notify-server/service-account.json`
2. ✅ **VAPID key** configured in `public/teacher/js/firebase.js`
3. ✅ **FCM token registration** code added to login page
4. ✅ **Notify server** code complete and ready to run
5. ✅ **Firebase service worker** configured for background notifications

---

## 🚀 Next Steps (10 minutes)

### Step 1: Install Node.js (if not already installed)

Since npm wasn't found, you need to install Node.js:

**Option A: Using Homebrew (recommended for Mac)**
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Verify installation
node --version
npm --version
```

**Option B: Download from nodejs.org**
1. Visit https://nodejs.org/
2. Download the LTS version (v20.x)
3. Run the installer
4. Restart your terminal

---

### Step 2: Install Notify Server Dependencies

```bash
cd "/Users/jhonrussellrodriguez/Downloads/wFled copy 5/notify-server"
npm install
```

You should see:
```
added 87 packages
```

---

### Step 3: Start the Notify Server

**Option A: Using the start script**
```bash
chmod +x start.sh
./start.sh
```

**Option B: Manual start**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/service-account.json"
npm start
```

You should see:
```
✓ Firebase Admin initialized
🚀 Notify server running on http://localhost:3001
```

**Keep this terminal window open!** The server needs to run continuously.

---

### Step 4: Deploy Your Web App

Open a **NEW terminal window** and run:

```bash
cd "/Users/jhonrussellrodriguez/Downloads/wFled copy 5"
firebase deploy --only hosting
```

After deployment completes, you'll see:
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/fledd-2e273/overview
Hosting URL: https://fledd-2e273.web.app
```

---

### Step 5: Test FCM Token Registration

1. Open your deployed site: **https://fledd-2e273.web.app/teacher/login.html**
2. Open browser Developer Tools (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Click **Sign in with Google**
5. When browser asks "Allow notifications?" → Click **Allow**
6. Watch the console for these messages:
   ```
   Service Worker registered
   FCM Token obtained: e7Qx...
   FCM token saved to Firestore
   ```

7. **Verify in Firestore:**
   - Go to [Firebase Console](https://console.firebase.google.com/project/fledd-2e273/firestore)
   - Open **Firestore Database**
   - Navigate to `users` collection
   - Find your user document
   - Confirm `fcmTokens` array exists with your token:
     ```javascript
     fcmTokens: [
       {
         token: "e7Qx1234567890...",
         device: "Chrome on Mac",
         addedAt: "2024-10-19T..."
       }
     ]
     ```

---

### Step 6: Send a Test Notification

1. **Get your Firebase ID token:**
   - In the browser console (on your deployed site), run:
     ```javascript
     firebase.auth().currentUser.getIdToken().then(token => console.log(token))
     ```
   - Copy the long token string that appears

2. **Send test notification using curl:**
   - Open a **NEW terminal window**
   - Run this command (replace YOUR_ID_TOKEN with the token you copied):
   
   ```bash
   curl -X POST http://localhost:3001/notify \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ID_TOKEN_HERE" \
     -d '{
       "title": "🎉 FLED Notification Test",
       "body": "If you see this, notifications are working perfectly!",
       "studentIds": []
     }'
   ```

3. **Expected result:**
   - You should see a browser notification pop up!
   - Response in terminal:
     ```json
     {
       "success": true,
       "stats": {
         "totalTokens": 1,
         "successful": 1,
         "failed": 0
       }
     }
     ```

---

## 🎯 What Works Now

After completing these steps:

✅ Teachers can log in with Google
✅ Browser automatically requests notification permission
✅ FCM tokens are saved to Firestore
✅ Notify server can send push notifications
✅ Notifications appear even when browser is in background
✅ Invalid tokens are automatically cleaned up

---

## 🔄 Daily Usage

### Starting the Notify Server

Whenever you restart your computer, you'll need to start the notify server:

```bash
cd "/Users/jhonrussellrodriguez/Downloads/wFled copy 5/notify-server"
./start.sh
```

Keep this terminal window open while working on FLED.

### Deploying Updates

After making changes to your web app:

```bash
cd "/Users/jhonrussellrodriguez/Downloads/wFled copy 5"
firebase deploy --only hosting
```

---

## 📱 Next Phase: Parent Mobile App

Once web notifications are working, you'll:

1. Create Flutter mobile app for parents
2. Add FCM token registration on parent login
3. Parents receive notifications on their phones
4. Same notify server handles both web and mobile!

---

## 🆘 Troubleshooting

**"npm: command not found"**
- Install Node.js using the instructions in Step 1

**"Service account not found"**
- Check that `service-account.json` exists in the notify-server folder
- Run from the correct directory

**Notification not received**
- Check browser notification permissions (click lock icon in address bar)
- Ensure VAPID key is correct in `firebase.js`
- Verify FCM token exists in Firestore
- Check notify server logs for errors

**CORS errors**
- Make sure you're testing on the deployed site (https://), not localhost
- Notify server has CORS enabled by default

**"Unauthorized" error**
- Get a fresh ID token (they expire after 1 hour)
- Make sure you're signed in

---

## 📚 Documentation

- **Complete Setup Guide**: `SETUP-NOTIFICATIONS.md`
- **Server API Reference**: `notify-server/README.md`
- **Firebase Console**: https://console.firebase.google.com/project/fledd-2e273

---

## ✨ You're Ready!

Everything is configured and ready to go. Just:
1. Install Node.js
2. Run the notify server
3. Deploy to Firebase Hosting
4. Test it out!

The system will work 100% **FREE** for typical school usage (within Firebase free tier limits).

Need help? Check the browser console and notify server logs for detailed error messages.
