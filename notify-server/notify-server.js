/**
 * FLED Notify Server - FCM Push Notification Service
 * Sends notifications when attendance or messages are created/updated
 */

const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

// Initialize Firebase Admin with service account
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const messaging = admin.messaging();

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Verify Firebase ID token middleware
 */
async function verifyToken(req, res, next) {
  const bearer = (req.header('Authorization') || '').replace('Bearer ', '');
  if (!bearer) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }
  
  try {
    req.user = await admin.auth().verifyIdToken(bearer);
    next();
  } catch (e) {
    console.error('Token verification failed:', e.message);
    return res.status(401).json({ error: 'Unauthorized - invalid token' });
  }
}

/**
 * Resolve FCM tokens for students by their IDs
 * Supports both email-based (recommended) and phone-based (legacy) lookups
 */
async function resolveTokensForStudentIds(studentIds) {
  const tokens = new Set();
  
  for (const sid of studentIds) {
    try {
      const studentSnap = await db.collection('students').doc(sid).get();
      if (!studentSnap.exists) {
        console.log(`⚠️  Student not found: ${sid}`);
        continue;
      }
      
      const studentData = studentSnap.data();
      const parentEmail = studentData?.parentEmail;
      const parentPhone = studentData?.parentPhone;
      
      // Try email-based lookup first (recommended)
      if (parentEmail) {
        const emailTokens = await getTokensByEmail(parentEmail);
        emailTokens.forEach(token => tokens.add(token));
      }
      
      // Fallback to phone-based lookup (legacy support)
      if (parentPhone && tokens.size === 0) {
        const phoneTokens = await getTokensByPhone(parentPhone);
        phoneTokens.forEach(token => tokens.add(token));
      }
      
      if (!parentEmail && !parentPhone) {
        console.log(`⚠️  No parent contact for student: ${sid}`);
      }
      
    } catch (e) {
      console.warn('Error resolving tokens for student', sid, e.message);
    }
  }
  
  return Array.from(tokens);
}

/**
 * Get FCM tokens by parent email (recommended method)
 */
async function getTokensByEmail(email) {
  const tokens = [];
  
  try {
    const usersQuery = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (!usersQuery.empty) {
      const userDoc = usersQuery.docs[0];
      const fcmTokens = userDoc.data()?.fcmTokens || [];
      
      fcmTokens.forEach(tokenObj => {
        const token = tokenObj?.token;
        if (token) tokens.push(token);
      });
      
      console.log(`✅ Found ${tokens.length} token(s) for email: ${email}`);
    } else {
      console.log(`⚠️  No user found with email: ${email}`);
    }
  } catch (e) {
    console.error(`Error getting tokens by email ${email}:`, e.message);
  }
  
  return tokens;
}

/**
 * Get FCM tokens by parent phone (legacy method)
 */
async function getTokensByPhone(phone) {
  const tokens = [];
  
  try {
    const usersQuery = await db.collection('users')
      .where('phone', '==', phone)
      .get();
    
    for (const userDoc of usersQuery.docs) {
      // Check fcmTokens array
      const fcmTokens = userDoc.data()?.fcmTokens || [];
      fcmTokens.forEach(tokenObj => {
        const token = tokenObj?.token;
        if (token) tokens.push(token);
      });
      
      // Fallback to top-level fcmToken field
      if (tokens.length === 0) {
        const token = userDoc.data()?.fcmToken;
        if (token) tokens.push(token);
      }
    }
    
    console.log(`✅ Found ${tokens.length} token(s) for phone: ${phone}`);
  } catch (e) {
    console.error(`Error getting tokens by phone ${phone}:`, e.message);
  }
  
  return tokens;
}

/**
 * Send notifications in batches (max 500 per batch)
 */
async function sendBatched(tokens, payload) {
  let totalSent = 0;
  let totalFailed = 0;
  const invalidTokens = [];
  
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    
    try {
      const response = await messaging.sendToDevice(batch, payload);
      totalSent += response.successCount || 0;
      totalFailed += response.failureCount || 0;
      
      // Collect invalid tokens for cleanup
      response.results.forEach((result, idx) => {
        if (result.error) {
          const errorCode = result.error.code;
          if (
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(batch[idx]);
          }
        }
      });
    } catch (e) {
      console.error('Batch send error:', e.message);
      totalFailed += batch.length;
    }
  }
  
  // Clean up invalid tokens
  if (invalidTokens.length > 0) {
    console.log('Cleaning up', invalidTokens.length, 'invalid tokens');
    await cleanupInvalidTokens(invalidTokens);
  }
  
  return { sent: totalSent, failed: totalFailed, invalidTokens: invalidTokens.length };
}

/**
 * Remove invalid tokens from database
 */
async function cleanupInvalidTokens(tokens) {
  for (const token of tokens) {
    try {
      // Remove from devices subcollection
      const devicesQuery = await db.collectionGroup('devices').where('token', '==', token).get();
      for (const doc of devicesQuery.docs) {
        await doc.ref.delete();
      }
      
      // Remove from top-level fcmToken field
      const usersQuery = await db.collection('users').where('fcmToken', '==', token).get();
      for (const doc of usersQuery.docs) {
        await doc.ref.update({ fcmToken: admin.firestore.FieldValue.delete() });
      }
    } catch (e) {
      console.warn('Error cleaning up token:', e.message);
    }
  }
}

/**
 * POST /notify - Send notification for a specific document
 * Body: { collection: 'messages' | 'attendanceSessions', docId: string }
 */
app.post('/notify', verifyToken, async (req, res) => {
  const { collection, docId } = req.body;
  
  if (!collection || !docId) {
    return res.status(400).json({ error: 'Missing collection or docId' });
  }
  
  if (!['messages', 'attendanceSessions', 'attendance'].includes(collection)) {
    return res.status(400).json({ error: 'Invalid collection' });
  }
  
  try {
    // Fetch the document
    const docSnap = await db.collection(collection).doc(docId).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const data = docSnap.data();
    
    // Determine student IDs
    let studentIds = data.studentIds || [];
    if (studentIds.length === 0 && data.studentId) {
      studentIds = [data.studentId];
    }
    
    if (studentIds.length === 0) {
      return res.json({ sent: 0, message: 'No student IDs found' });
    }
    
    // Resolve tokens
    const tokens = await resolveTokensForStudentIds(studentIds);
    
    if (tokens.length === 0) {
      return res.json({ sent: 0, message: 'No FCM tokens found for students' });
    }
    
    // Build notification payload
    let title, body;
    
    if (collection === 'messages') {
      title = data.title || 'New Message from Teacher';
      body = (data.content || '').slice(0, 200);
    } else if (collection === 'attendanceSessions' || collection === 'attendance') {
      title = 'Attendance Update';
      body = `Attendance marked: ${data.status || 'Updated'}`;
      if (data.notes) body += ` - ${data.notes.slice(0, 100)}`;
    }
    
    const payload = {
      notification: { title, body },
      data: {
        type: collection,
        docId: docId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      }
    };
    
    // Send notifications
    const result = await sendBatched(tokens, payload);
    
    console.log(`Sent ${result.sent} notifications for ${collection}/${docId}`);
    
    return res.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      totalTokens: tokens.length,
      invalidTokensRemoved: result.invalidTokens
    });
    
  } catch (error) {
    console.error('Notify error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Start server
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('=====================================');
  console.log('FLED Notify Server Started');
  console.log(`Listening on port ${PORT}`);
  console.log('Ready to send FCM notifications');
  console.log('=====================================');
});
