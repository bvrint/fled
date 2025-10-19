# Parent App Setup with Google OAuth

## Why Google OAuth for Parents?

✅ **FREE** - No Blaze plan required
✅ **No SMS costs** - Save money on verification
✅ **Faster login** - One tap sign in
✅ **More secure** - Google handles verification
✅ **Consistent** - Same as teacher login
✅ **Better UX** - No waiting for OTP codes

---

## Updated Data Model

### Students Collection
```javascript
{
  id: "student-001",
  name: "John Doe",
  parentEmail: "parent@gmail.com",  // Changed from parentPhone
  teacherUid: "teacher-uid-123",
  // ... other fields
}
```

### Users Collection
```javascript
{
  uid: "firebase-auth-uid",          // From Google OAuth
  email: "parent@gmail.com",         // From Google account
  name: "Parent Name",               // From Google profile
  photoURL: "https://...",           // From Google profile
  role: "parent",                    // or "teacher"
  fcmTokens: [
    {
      token: "fcm-token-here",
      device: "Android - Samsung",
      addedAt: "2024-10-19T..."
    }
  ],
  createdAt: "2024-10-19T...",
  verified: true                     // Google emails are always verified
}
```

---

## Flutter Implementation - Google OAuth

### Step 1: Add Dependencies

Update `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # Firebase
  firebase_core: ^2.24.2
  firebase_auth: ^4.15.3              # For Google OAuth
  firebase_messaging: ^14.7.9         # For FCM
  cloud_firestore: ^4.13.6            # For Firestore
  google_sign_in: ^6.2.1              # For Google Sign In
  flutter_local_notifications: ^16.3.0
```

Run:
```bash
flutter pub get
```

---

### Step 2: Configure Google Sign-In

#### Android Configuration

1. **Download SHA-1 fingerprint:**
```bash
cd android
./gradlew signingReport
```
Copy the SHA-1 from "debug" variant.

2. **Add to Firebase Console:**
   - Go to Project Settings > Your Android App
   - Add SHA-1 fingerprint
   - Download new `google-services.json`
   - Replace in `android/app/google-services.json`

#### iOS Configuration (if needed)

1. Add URL scheme to `ios/Runner/Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.YOUR-CLIENT-ID</string>
    </array>
  </dict>
</array>
```

Get CLIENT-ID from `GoogleService-Info.plist` (REVERSED_CLIENT_ID)

---

### Step 3: Create Authentication Service

Create `lib/services/auth_service.dart`:

```dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // Get current user
  User? get currentUser => _auth.currentUser;

  // Stream of auth state changes
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  /// Sign in with Google
  Future<User?> signInWithGoogle() async {
    try {
      // Trigger the Google Sign In flow
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      
      if (googleUser == null) {
        print('❌ Google sign-in cancelled by user');
        return null;
      }

      // Obtain the auth details from the request
      final GoogleSignInAuthentication googleAuth = 
          await googleUser.authentication;

      // Create a new credential
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // Sign in to Firebase with the Google credential
      final UserCredential userCredential = 
          await _auth.signInWithCredential(credential);
      
      final User? user = userCredential.user;
      
      if (user != null) {
        print('✅ Signed in: ${user.email}');
        
        // Create/update user document in Firestore
        await _createOrUpdateUserDocument(user);
        
        return user;
      }
      
      return null;
    } catch (e) {
      print('❌ Google sign-in error: $e');
      return null;
    }
  }

  /// Create or update user document in Firestore
  Future<void> _createOrUpdateUserDocument(User user) async {
    try {
      final userRef = _firestore.collection('users').doc(user.uid);
      final docSnapshot = await userRef.get();

      if (!docSnapshot.exists) {
        // Create new user document
        await userRef.set({
          'uid': user.uid,
          'email': user.email,
          'name': user.displayName ?? '',
          'photoURL': user.photoURL ?? '',
          'role': 'parent',  // Default role for mobile app
          'verified': true,   // Google accounts are always verified
          'createdAt': FieldValue.serverTimestamp(),
        });
        print('✅ Created new parent user document');
      } else {
        // Update existing user
        await userRef.update({
          'name': user.displayName ?? '',
          'photoURL': user.photoURL ?? '',
          'lastLogin': FieldValue.serverTimestamp(),
        });
        print('✅ Updated existing user document');
      }
    } catch (e) {
      print('❌ Error creating/updating user document: $e');
    }
  }

  /// Sign out
  Future<void> signOut() async {
    try {
      await _googleSignIn.signOut();
      await _auth.signOut();
      print('✅ Signed out successfully');
    } catch (e) {
      print('❌ Sign out error: $e');
    }
  }

  /// Get user's children (students)
  Future<List<DocumentSnapshot>> getUserChildren() async {
    try {
      final user = currentUser;
      if (user == null || user.email == null) {
        return [];
      }

      // Query students where parentEmail matches user's email
      final QuerySnapshot snapshot = await _firestore
          .collection('students')
          .where('parentEmail', isEqualTo: user.email)
          .get();

      return snapshot.docs;
    } catch (e) {
      print('❌ Error getting children: $e');
      return [];
    }
  }

  /// Check if user has children linked
  Future<bool> hasLinkedChildren() async {
    final children = await getUserChildren();
    return children.isNotEmpty;
  }
}
```

---

### Step 4: Update FCM Service for Email-Based Lookup

Update `lib/services/fcm_service.dart`:

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:io' show Platform;

class FCMService {
  final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = 
      FlutterLocalNotificationsPlugin();
  final FirebaseAuth _auth = FirebaseAuth.instance;

  /// Initialize FCM and request permissions
  Future<void> initialize() async {
    NotificationSettings settings = await _firebaseMessaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('✅ Notification permission granted');
      
      await _initializeLocalNotifications();
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
      FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);
      
      RemoteMessage? initialMessage = 
          await _firebaseMessaging.getInitialMessage();
      if (initialMessage != null) {
        _handleMessageOpenedApp(initialMessage);
      }
    } else {
      print('❌ Notification permission denied');
    }
  }

  /// Initialize local notifications
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
        print('Notification tapped: ${response.payload}');
      },
    );
  }

  /// Handle foreground messages
  void _handleForegroundMessage(RemoteMessage message) {
    print('📨 Foreground message: ${message.notification?.title}');
    
    _showLocalNotification(
      title: message.notification?.title ?? 'FLED',
      body: message.notification?.body ?? '',
      payload: message.data.toString(),
    );
  }

  /// Handle notification tap
  void _handleMessageOpenedApp(RemoteMessage message) {
    print('🔔 Notification tapped: ${message.notification?.title}');
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
      channelDescription: 'Student updates and notifications',
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

  /// Save FCM token to Firestore (EMAIL-BASED)
  /// Call this after successful Google sign-in
  Future<void> saveTokenToFirestore() async {
    try {
      final user = _auth.currentUser;
      if (user == null) {
        print('❌ No authenticated user');
        return;
      }

      // Get FCM token
      String? token = await _firebaseMessaging.getToken();
      
      if (token == null) {
        print('❌ Failed to get FCM token');
        return;
      }

      print('✅ FCM Token: ${token.substring(0, 20)}...');

      // Save to user document using UID (not email lookup)
      final userRef = FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid);

      final docSnapshot = await userRef.get();
      
      if (!docSnapshot.exists) {
        print('⚠️ User document does not exist');
        return;
      }

      // Check if token already exists
      final userData = docSnapshot.data() as Map<String, dynamic>;
      List<dynamic> existingTokens = userData['fcmTokens'] ?? [];
      bool tokenExists = existingTokens.any((t) => t['token'] == token);

      if (!tokenExists) {
        // Add new token
        await userRef.update({
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
        print('ℹ️ Token already exists');
      }

      // Listen for token refresh
      _firebaseMessaging.onTokenRefresh.listen((newToken) {
        print('🔄 Token refreshed');
        saveTokenToFirestore();
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

### Step 5: Create Login Screen

Create `lib/screens/login_screen.dart`:

```dart
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/fcm_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final AuthService _authService = AuthService();
  final FCMService _fcmService = FCMService();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    // Initialize FCM when app starts
    _fcmService.initialize();
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() => _isLoading = true);

    try {
      // Sign in with Google
      final user = await _authService.signInWithGoogle();

      if (user != null) {
        // Save FCM token
        await _fcmService.saveTokenToFirestore();

        // Check if user has linked children
        final hasChildren = await _authService.hasLinkedChildren();

        if (!hasChildren) {
          // Show message about linking children
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'Welcome! Ask your child\'s teacher to link your email to their student profile.'
                ),
                duration: Duration(seconds: 5),
              ),
            );
          }
        }

        // Navigate to home screen
        if (mounted) {
          Navigator.pushReplacementNamed(context, '/home');
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sign in failed: $e')),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Logo or app name
              const Text(
                'FLED',
                style: TextStyle(
                  fontSize: 48,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Family Link Educational Dashboard',
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),

              // Google Sign In Button
              _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : ElevatedButton.icon(
                      onPressed: _handleGoogleSignIn,
                      icon: Image.network(
                        'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
                        height: 24,
                      ),
                      label: const Text('Sign in with Google'),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.all(16),
                        backgroundColor: Colors.white,
                        foregroundColor: Colors.black87,
                      ),
                    ),
              
              const SizedBox(height: 24),
              
              // Info text
              const Text(
                'Sign in with your Google account to view your child\'s information and receive notifications.',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

---

### Step 6: Update main.dart

```dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

// Background message handler
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
  
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FLED Parent',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      initialRoute: '/login',
      routes: {
        '/login': (context) => const LoginScreen(),
        '/home': (context) => const HomeScreen(),
      },
    );
  }
}
```

---

## Update Notify Server (Email-Based Lookup)

The notify server needs to query by email instead of phone.

Update `/notify-server/notify-server.js`:

```javascript
// Find parent tokens by email (instead of phone)
async function resolveParentTokens(studentIds) {
  const tokens = [];
  const parentEmails = new Set();

  for (const studentId of studentIds) {
    try {
      // Get student document
      const studentDoc = await db.collection('students').doc(studentId).get();
      
      if (!studentDoc.exists) {
        console.log(`⚠️  Student not found: ${studentId}`);
        continue;
      }

      const studentData = studentDoc.data();
      const parentEmail = studentData.parentEmail;  // Changed from parentPhone

      if (parentEmail) {
        parentEmails.add(parentEmail);
      }
    } catch (error) {
      console.error(`Error resolving student ${studentId}:`, error);
    }
  }

  // Query users by email
  for (const email of parentEmails) {
    try {
      const usersSnapshot = await db
        .collection('users')
        .where('email', '==', email)  // Changed from phone
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        const userData = usersSnapshot.docs[0].data();
        const fcmTokens = userData.fcmTokens || [];
        
        fcmTokens.forEach(tokenObj => {
          if (tokenObj.token) {
            tokens.push(tokenObj.token);
          }
        });
      }
    } catch (error) {
      console.error(`Error getting tokens for ${email}:`, error);
    }
  }

  return tokens;
}
```

---

## Migration Steps

1. **Update Firestore structure:**
   - Add `parentEmail` field to all students
   - Teachers can add parent email when creating student profile

2. **Deploy updated notify server**

3. **Build and test Flutter app with Google OAuth**

4. **Remove phone authentication code** (no longer needed)

---

## Benefits Summary

✅ **No Blaze Plan Required** - Stay on free Spark plan
✅ **No SMS Costs** - Save money
✅ **Faster Login** - One tap Google sign-in
✅ **Better Security** - Google handles verification
✅ **Consistent UX** - Same as teacher login
✅ **Works Worldwide** - No SMS delivery issues
✅ **FCM Still Free** - Notifications work the same

This is definitely the better approach! Want me to help you implement it?
