# 🚀 Flutter Mobile App - Simple Implementation Guide

## What You Need To Do

Follow these steps **in your actual Flutter project** (not this repo):

---

## ✅ Step 1: Update pubspec.yaml (2 minutes)

Open your Flutter project's `pubspec.yaml` and add:

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # Firebase & Auth
  firebase_core: ^2.24.2
  firebase_auth: ^4.15.3
  google_sign_in: ^6.2.1
  cloud_firestore: ^4.13.6
  
  # FCM
  firebase_messaging: ^14.7.9
  flutter_local_notifications: ^16.3.0
```

Then run:
```bash
cd your-flutter-project
flutter pub get
```

---

## ✅ Step 2: Download Firebase Config (5 minutes)

### For Android:
1. Go to https://console.firebase.google.com/project/fledd-2e273
2. Click ⚙️ > Project Settings > Your Apps
3. Click Android app (or "Add app")
4. Enter package name (e.g., `com.fled.parent`)
5. Download `google-services.json`
6. Put it in: `android/app/google-services.json`

### Get SHA-1:
```bash
cd android
./gradlew signingReport
```
Copy the SHA-1 and add it in Firebase Console > Project Settings > Android app > Add fingerprint

---

## ✅ Step 3: Configure Android (5 minutes)

### `android/build.gradle`:
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'  // Add
    }
}
```

### `android/app/build.gradle`:
At the very bottom:
```gradle
apply plugin: 'com.google.gms.google-services'  // Add this line
```

Also ensure:
```gradle
android {
    defaultConfig {
        minSdkVersion 21  // At least 21
    }
}
```

### `android/app/src/main/AndroidManifest.xml`:
```xml
<manifest>
    <application>
        <!-- Add this -->
        <service
            android:name="com.google.firebase.messaging.FirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
    </application>
    
    <!-- Add these -->
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
</manifest>
```

---

## ✅ Step 4: Copy Service Files (5 minutes)

Create these files in your Flutter project:

1. **`lib/services/auth_service.dart`**
   - Copy from: `flutter_code_examples/auth_service.dart`
   
2. **`lib/services/fcm_service.dart`**
   - Copy from: `flutter_code_examples/fcm_service.dart`

3. **`lib/screens/login_screen.dart`**
   - Copy from: `flutter_code_examples/login_screen.dart`

All files are in this repo at:
```
/Users/jhonrussellrodriguez/Downloads/wFled copy 5/flutter_code_examples/
```

---

## ✅ Step 5: Update main.dart (2 minutes)

Replace your `lib/main.dart` with the template from:
```
flutter_code_examples/main.dart
```

Or add these key parts:

1. **Top of file (outside main):**
```dart
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('📨 Background message: ${message.notification?.title}');
}
```

2. **In main() function:**
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  runApp(const MyApp());
}
```

---

## ✅ Step 6: Replace Your Login Screen (5 minutes)

**Remove your old phone authentication code**

Your new login flow is:
```dart
// In your login screen
final AuthService _authService = AuthService();
final FCMService _fcmService = FCMService();

// Initialize FCM
@override
void initState() {
  super.initState();
  _fcmService.initialize();
}

// Google Sign In button
onPressed: () async {
  final user = await _authService.signInWithGoogle();
  if (user != null) {
    await _fcmService.saveTokenToFirestore();
    Navigator.pushReplacementNamed(context, '/home');
  }
}
```

---

## ✅ Step 7: Update Your Home Screen (5 minutes)

To get and display students:

```dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class HomeScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    
    return Scaffold(
      appBar: AppBar(
        title: Text('My Children'),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('students')
            .where('parentEmail', isEqualTo: user?.email)
            .snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return Center(child: CircularProgressIndicator());
          }
          
          final students = snapshot.data!.docs;
          
          if (students.isEmpty) {
            return Center(
              child: Text('No students linked to your account'),
            );
          }
          
          return ListView.builder(
            itemCount: students.length,
            itemBuilder: (context, index) {
              final student = students[index].data() as Map<String, dynamic>;
              return ListTile(
                title: Text(student['name'] ?? 'Unknown'),
                subtitle: Text(student['grade'] ?? ''),
                onTap: () {
                  // Navigate to student details
                },
              );
            },
          );
        },
      ),
    );
  }
}
```

---

## ✅ Step 8: Test (10 minutes)

### Build and Run:
```bash
flutter clean
flutter pub get
flutter run
```

### Test Login:
1. App opens
2. Click "Sign in with Google"
3. Select your Google account
4. App should:
   - Sign you in
   - Save FCM token to Firestore
   - Show home screen

### Verify in Firebase Console:
1. Go to Firestore > `users` collection
2. Find your user document
3. Check `fcmTokens` array exists with your device token

---

## ✅ Step 9: Link Student (in Web Dashboard)

Teachers need to add parent emails when creating students:

In your teacher web dashboard, update student creation to include `parentEmail`:

```javascript
// In teacher dashboard when creating student
await addDoc(collection(db, 'students'), {
  name: 'Student Name',
  parentEmail: 'parent@gmail.com',  // Add this!
  teacherUid: auth.currentUser.uid,
  createdAt: serverTimestamp()
});
```

---

## ✅ Step 10: Test Notifications

### Send Test Notification:

1. **Make sure notify server is running:**
```bash
cd "/Users/jhonrussellrodriguez/Downloads/wFled copy 5/notify-server"
npm start
```

2. **Create test student in Firestore:**
```javascript
{
  id: "test-student-001",
  name: "Test Student",
  parentEmail: "your-email@gmail.com",  // Your Google account
  teacherUid: "your-teacher-uid"
}
```

3. **Send notification from teacher dashboard:**
   - Mark attendance
   - Or use curl:
```bash
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEACHER_ID_TOKEN" \
  -d '{
    "title": "Test Notification",
    "body": "Your child has been marked present",
    "studentIds": ["test-student-001"]
  }'
```

4. **Check your phone** - you should receive a notification!

---

## 📁 File Structure (Your Flutter Project)

```
your-flutter-project/
├── lib/
│   ├── main.dart                    # Updated with Firebase init
│   ├── services/
│   │   ├── auth_service.dart        # Google OAuth
│   │   └── fcm_service.dart         # FCM notifications
│   └── screens/
│       ├── login_screen.dart        # New Google login
│       └── home_screen.dart         # Your existing home (updated)
├── android/
│   ├── app/
│   │   ├── google-services.json     # Firebase config
│   │   ├── build.gradle             # Updated
│   │   └── src/main/AndroidManifest.xml  # Updated
│   └── build.gradle                 # Updated
└── pubspec.yaml                     # Updated with dependencies
```

---

## 🎯 Summary Checklist

- [ ] Update `pubspec.yaml` with dependencies
- [ ] Download `google-services.json` and add SHA-1
- [ ] Update Android gradle files
- [ ] Update AndroidManifest.xml
- [ ] Copy auth_service.dart
- [ ] Copy fcm_service.dart  
- [ ] Copy login_screen.dart
- [ ] Update main.dart
- [ ] Update home screen to query by parentEmail
- [ ] Build and test
- [ ] Verify FCM token in Firestore
- [ ] Link test student with your email
- [ ] Send test notification

---

## 🆘 Common Issues

**"google-services.json not found"**
- Make sure it's in `android/app/google-services.json`
- Run `flutter clean` then `flutter run`

**"Failed to authenticate"**
- Check SHA-1 is added in Firebase Console
- Download new `google-services.json` after adding SHA-1

**"No students found"**
- Check student document has `parentEmail` field
- Make sure email matches your Google account exactly

**Build errors**
- Run `flutter clean`
- Run `flutter pub get`
- Check all gradle files are updated

---

## 💡 Key Changes from Phone Auth

**Before (Phone):**
```dart
- Enter phone number
- Wait for OTP
- Enter code
- Link by phone number
```

**After (Google OAuth):**
```dart
✅ Tap "Sign in with Google"
✅ Select account (2 seconds)
✅ Done! Link by email
```

**Firestore Changes:**
```javascript
// Before
students: { parentPhone: "+1234567890" }

// After
students: { parentEmail: "parent@gmail.com" }
```

---

## Next Steps

1. **Copy the 3 service files** to your Flutter project
2. **Update configurations** (gradle, manifest, pubspec.yaml)
3. **Test login** with your Google account
4. **Link a student** with your email in Firestore
5. **Send test notification** from teacher dashboard

Need help with any specific step? Let me know!
