# Adding FCM Notifications to Your Existing Flutter App

## Overview
Since you already have a Flutter app with phone number login, you just need to:
1. Add FCM dependencies
2. Save FCM token when parent logs in
3. Handle incoming notifications

Your existing flow:
```
Parent logs in with phone number → Firestore queries using phone number → Show student data
```

New flow with notifications:
```
Parent logs in with phone number → Save FCM token to Firestore → Receive notifications
```

---

## Step 1: Add Dependencies to pubspec.yaml

Open your Flutter project and add these to `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # Your existing dependencies...
  
  # Add these for FCM:
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.9
  flutter_local_notifications: ^16.3.0  # For foreground notifications
```

Then run:
```bash
flutter pub get
```

---

## Step 2: Configure Firebase for Android

### 2.1 Download google-services.json

1. Go to [Firebase Console](https://console.firebase.google.com/project/fledd-2e273)
2. Click the Android icon (or "Add app" if you haven't added Android yet)
3. Enter your package name (e.g., `com.fled.parent_app`)
4. Download `google-services.json`
5. Place it in: `android/app/google-services.json`

### 2.2 Update android/build.gradle

Add this to `android/build.gradle`:

```gradle
buildscript {
    dependencies {
        // Your existing dependencies...
        classpath 'com.google.gms:google-services:4.4.0'  // Add this
    }
}
```

### 2.3 Update android/app/build.gradle

Add at the bottom of `android/app/build.gradle`:

```gradle
apply plugin: 'com.google.gms.google-services'  // Add this line at the very end
```

Also ensure minimum SDK is 21:
```gradle
android {
    defaultConfig {
        minSdkVersion 21  // Make sure it's at least 21
    }
}
```

---

## Step 3: Configure Firebase for iOS (if supporting iOS)

### 3.1 Download GoogleService-Info.plist

1. In Firebase Console, click the iOS icon
2. Enter your bundle ID (e.g., `com.fled.parentApp`)
3. Download `GoogleService-Info.plist`
4. Open your iOS project in Xcode: `open ios/Runner.xcworkspace`
5. Drag `GoogleService-Info.plist` into the `Runner` folder in Xcode
6. Check "Copy items if needed"

### 3.2 Enable Push Notifications

In Xcode:
1. Select `Runner` project
2. Go to "Signing & Capabilities"
3. Click "+ Capability"
4. Add "Push Notifications"
5. Add "Background Modes" and check "Remote notifications"

---

## Step 4: Create FCM Service (Dart Code)

Create a new file: `lib/services/fcm_service.dart`

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:io' show Platform;

class FCMService {
  final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = 
      FlutterLocalNotificationsPlugin();

  /// Initialize FCM and request permissions
  Future<void> initialize() async {
    // Request permission (iOS will show dialog, Android auto-grants)
    NotificationSettings settings = await _firebaseMessaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('✅ Notification permission granted');
      
      // Initialize local notifications for foreground display
      await _initializeLocalNotifications();
      
      // Handle foreground messages
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
      
      // Handle background/terminated messages
      FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);
      
      // Check if app was opened from notification
      RemoteMessage? initialMessage = 
          await _firebaseMessaging.getInitialMessage();
      if (initialMessage != null) {
        _handleMessageOpenedApp(initialMessage);
      }
      
    } else {
      print('❌ Notification permission denied');
    }
  }

  /// Initialize local notifications for foreground display
  Future<void> _initializeLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    
    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      settings,
      onDidReceiveNotificationResponse: (response) {
        // Handle notification tap
        print('Notification tapped: ${response.payload}');
      },
    );
  }

  /// Handle foreground messages (when app is open)
  void _handleForegroundMessage(RemoteMessage message) {
    print('📨 Foreground message received: ${message.notification?.title}');
    
    // Show local notification
    _showLocalNotification(
      title: message.notification?.title ?? 'FLED',
      body: message.notification?.body ?? '',
      payload: message.data.toString(),
    );
  }

  /// Handle when user taps notification (app in background)
  void _handleMessageOpenedApp(RemoteMessage message) {
    print('🔔 User tapped notification: ${message.notification?.title}');
    
    // Navigate to relevant screen based on notification data
    // You can add navigation logic here
    // Example: Navigator.pushNamed(context, '/attendance');
  }

  /// Show local notification
  Future<void> _showLocalNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'fled_channel',
      'FLED Notifications',
      channelDescription: 'Notifications for student updates',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      DateTime.now().millisecond,
      title,
      body,
      details,
      payload: payload,
    );
  }

  /// Save FCM token to Firestore after parent login
  /// Call this after successful phone number authentication
  Future<void> saveTokenToFirestore(String phoneNumber) async {
    try {
      // Get FCM token
      String? token = await _firebaseMessaging.getToken();
      
      if (token == null) {
        print('❌ Failed to get FCM token');
        return;
      }

      print('✅ FCM Token: ${token.substring(0, 20)}...');

      // Find user document by phone number
      final QuerySnapshot userQuery = await FirebaseFirestore.instance
          .collection('users')
          .where('phone', isEqualTo: phoneNumber)
          .limit(1)
          .get();

      if (userQuery.docs.isEmpty) {
        print('⚠️ No user found with phone: $phoneNumber');
        // Create user document if it doesn't exist
        await FirebaseFirestore.instance.collection('users').add({
          'phone': phoneNumber,
          'role': 'parent',
          'fcmTokens': [
            {
              'token': token,
              'device': _getDeviceInfo(),
              'addedAt': FieldValue.serverTimestamp(),
            }
          ],
          'createdAt': FieldValue.serverTimestamp(),
        });
        print('✅ Created new user document with FCM token');
        return;
      }

      // Update existing user document
      final String userId = userQuery.docs.first.id;
      final Map<String, dynamic> userData = 
          userQuery.docs.first.data() as Map<String, dynamic>;

      // Check if token already exists
      List<dynamic> existingTokens = userData['fcmTokens'] ?? [];
      bool tokenExists = existingTokens.any((t) => t['token'] == token);

      if (!tokenExists) {
        // Add new token
        await FirebaseFirestore.instance
            .collection('users')
            .doc(userId)
            .update({
          'fcmTokens': FieldValue.arrayUnion([
            {
              'token': token,
              'device': _getDeviceInfo(),
              'addedAt': FieldValue.serverTimestamp(),
            }
          ]),
          'lastTokenUpdate': FieldValue.serverTimestamp(),
        });
        print('✅ FCM token saved to Firestore');
      } else {
        print('ℹ️ Token already exists in Firestore');
      }

      // Listen for token refresh
      _firebaseMessaging.onTokenRefresh.listen((newToken) {
        print('🔄 Token refreshed');
        saveTokenToFirestore(phoneNumber);
      });

    } catch (e) {
      print('❌ Error saving FCM token: $e');
    }
  }

  /// Get device information
  String _getDeviceInfo() {
    if (Platform.isAndroid) {
      return 'Android - ${Platform.operatingSystemVersion}';
    } else if (Platform.isIOS) {
      return 'iOS - ${Platform.operatingSystemVersion}';
    } else {
      return 'Unknown Device';
    }
  }
}
```

---

## Step 5: Handle Background Messages

Create a new file: `lib/main.dart` (update your existing main.dart)

Add this at the TOP of your `main.dart` file, OUTSIDE the main() function:

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

// Background message handler - must be top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('📨 Background message: ${message.notification?.title}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase
  await Firebase.initializeApp();
  
  // Set background message handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  
  runApp(MyApp());
}
```

---

## Step 6: Integrate into Your Login Flow

Update your login screen to save FCM token after successful authentication:

```dart
import 'services/fcm_service.dart';

class LoginScreen extends StatefulWidget {
  // Your existing code...
}

class _LoginScreenState extends State<LoginScreen> {
  final FCMService _fcmService = FCMService();
  
  @override
  void initState() {
    super.initState();
    // Initialize FCM when app starts
    _fcmService.initialize();
  }

  Future<void> _handleLogin(String phoneNumber) async {
    // Your existing login logic...
    
    // After successful login:
    try {
      // Save FCM token
      await _fcmService.saveTokenToFirestore(phoneNumber);
      
      // Navigate to home screen
      Navigator.pushReplacementNamed(context, '/home');
      
    } catch (e) {
      print('Login error: $e');
    }
  }
}
```

---

## Step 7: Update AndroidManifest.xml (Important!)

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest>
    <application>
        <!-- Your existing code... -->
        
        <!-- Add FCM service -->
        <service
            android:name="com.google.firebase.messaging.FirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
        
        <!-- Notification icon -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@mipmap/ic_launcher" />
            
        <!-- Notification color -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:resource="@color/colorPrimary" />
            
    </application>
    
    <!-- Add internet permission if not already present -->
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
</manifest>
```

---

## Step 8: Test the Integration

### 8.1 Build and install the app
```bash
flutter clean
flutter pub get
flutter run
```

### 8.2 Login and check console
- Login with a parent phone number (e.g., `+1234567890`)
- Check console output for: `✅ FCM token saved to Firestore`

### 8.3 Verify in Firestore
1. Go to Firebase Console > Firestore
2. Open `users` collection
3. Find user with matching phone number
4. Check `fcmTokens` array has your device token

### 8.4 Send test notification
```bash
cd "/Users/jhonrussellrodriguez/Downloads/wFled copy 5"

# First, make sure notify server is running
cd notify-server
npm start

# In another terminal, create a test student linked to parent
```

---

## Step 9: Create Test Data (Firestore)

Create these documents in Firestore Console:

**students collection:**
```javascript
{
  id: "test-student-001",
  name: "Test Student",
  parentPhone: "+1234567890",  // Use your test phone number
  teacherUid: "your-teacher-uid"
}
```

**Now send notification from your teacher dashboard:**
```javascript
// In teacher dashboard, mark attendance or create task
// It will automatically send notification to parent with matching phone
```

---

## Step 10: Integration with Teacher Dashboard

Your teacher dashboard already has the code structure. Now add the actual notification calls:

### In `public/teacher/js/attendance.js`:

```javascript
async function saveAttendance(sessionId, studentId, status) {
  // ... your existing save code ...
  
  // Send notification to parent
  try {
    const idToken = await auth.currentUser.getIdToken();
    await fetch('http://localhost:3000/notify', {  // Change to your production URL
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
  } catch (error) {
    console.error('Notification error:', error);
  }
}
```

---

## Summary: What You Need to Do

1. ✅ **Add 3 dependencies** to pubspec.yaml
2. ✅ **Download google-services.json** and add to android/app/
3. ✅ **Copy FCMService class** to your Flutter project
4. ✅ **Update main.dart** with background handler
5. ✅ **Update login flow** to save FCM token
6. ✅ **Update AndroidManifest.xml** with FCM config
7. ✅ **Create test student** in Firestore with parent phone
8. ✅ **Test notification** from teacher dashboard

**Time estimate: 30-45 minutes**

---

## The Complete Flow

```
Teacher marks attendance
    ↓
Teacher dashboard calls POST /notify with studentIds
    ↓
Notify server queries: students → parentPhone
    ↓
Notify server queries: users (where phone = parentPhone)
    ↓
Notify server gets fcmTokens array
    ↓
Notify server sends FCM message to all parent tokens
    ↓
Parent's phone receives notification ✅
```

---

## Need Help?

I can help you with:
1. Creating the FCMService class in your project
2. Updating your login flow
3. Testing the notifications
4. Deploying the notify server to production

Want me to help with any specific part?
