# Flutter FCM Integration Checklist

## ✅ Quick Setup Checklist

### 1. Firebase Configuration
- [ ] Download `google-services.json` from Firebase Console
- [ ] Place in `android/app/google-services.json`
- [ ] Download `GoogleService-Info.plist` (iOS) if needed
- [ ] Place in `ios/Runner/` via Xcode

### 2. Dependencies
- [ ] Add `firebase_core: ^2.24.2` to pubspec.yaml
- [ ] Add `firebase_messaging: ^14.7.9` to pubspec.yaml
- [ ] Add `flutter_local_notifications: ^16.3.0` to pubspec.yaml
- [ ] Run `flutter pub get`

### 3. Android Configuration
- [ ] Update `android/build.gradle` - add google-services classpath
- [ ] Update `android/app/build.gradle` - apply plugin at bottom
- [ ] Update `android/app/src/main/AndroidManifest.xml` - add FCM service
- [ ] Set `minSdkVersion 21` in build.gradle

### 4. iOS Configuration (if applicable)
- [ ] Add GoogleService-Info.plist via Xcode
- [ ] Enable "Push Notifications" capability
- [ ] Enable "Background Modes" > "Remote notifications"

### 5. Code Integration
- [ ] Create `lib/services/fcm_service.dart` with FCMService class
- [ ] Update `lib/main.dart` with background handler
- [ ] Initialize FCM in your app startup
- [ ] Call `saveTokenToFirestore(phoneNumber)` after login

### 6. Testing
- [ ] Build and run app: `flutter run`
- [ ] Login with phone number
- [ ] Check console for "FCM token saved to Firestore"
- [ ] Verify token in Firebase Console > Firestore > users collection
- [ ] Create test student with matching parentPhone
- [ ] Send test notification from teacher dashboard

### 7. Production Setup
- [ ] Update notify server URL in teacher dashboard (change from localhost)
- [ ] Deploy notify server to Cloud Run or VPS
- [ ] Test end-to-end notification flow

---

## 📱 Current System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Teacher Web Dashboard                      │
│  • Teacher marks attendance                                   │
│  • Teacher creates task                                       │
│  • Dashboard calls: POST /notify with studentIds             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              Notify Server (Node.js + Admin SDK)             │
│  • Receives notification request                             │
│  • Queries: students/{studentId} → get parentPhone           │
│  • Queries: users where phone == parentPhone                 │
│  • Extracts fcmTokens array                                  │
│  • Sends FCM notification to all parent tokens               │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              Firebase Cloud Messaging (FCM)                   │
│  • Delivers push notification to devices                      │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              Parent Flutter Mobile App                        │
│  • Parent logs in with phone number                           │
│  • FCM token saved to Firestore users collection             │
│  • Receives notification on device ✅                         │
│  • Shows notification even when app is closed                │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Points

**Your existing login flow works perfectly!**
- ✅ Parent logs in with phone number
- ✅ App queries Firestore using phone number
- ✅ Shows student data

**What's new:**
- ✅ After login, save FCM token to same user document
- ✅ Token gets stored in `fcmTokens` array
- ✅ Notify server uses phone number to find tokens
- ✅ Notifications delivered automatically

**No changes needed to:**
- ❌ Your login logic
- ❌ Your data retrieval
- ❌ Your phone number identifier system

**Only additions:**
- ✅ FCM token registration after login
- ✅ Notification handling
- ✅ Firebase Messaging dependencies

---

## 🎯 Next Actions

1. **Open your Flutter project**
2. **Follow FLUTTER-FCM-INTEGRATION.md step by step**
3. **Test with your existing phone number login**
4. **Verify notifications work**

The notify server is already running and ready to send notifications as soon as your Flutter app saves FCM tokens!

---

## 🆘 Common Issues

**"Failed to get FCM token"**
- Ensure google-services.json is in the correct location
- Check Firebase project is properly configured
- Verify internet connection

**"No user found with phone"**
- Make sure phone number format matches (e.g., +1234567890)
- Check Firestore for existing user document
- Service will create new user if doesn't exist

**"Notification not received"**
- Check app permissions (Settings > Apps > Your App > Notifications)
- Verify FCM token is saved in Firestore
- Check notify server logs
- Ensure phone number in student matches user phone

**Build errors**
- Run `flutter clean && flutter pub get`
- Check all dependencies are compatible
- Ensure minSdkVersion is 21+

---

Ready to integrate! Let me know if you need help with any specific step.
