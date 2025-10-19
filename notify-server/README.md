# FLED Notify Server

Node.js server for sending FCM push notifications via Firebase Admin SDK.

## Quick Start

1. **Get service account credentials:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select project: fledd-2e273
   - Settings > Service Accounts > Generate new private key
   - Save as `service-account.json` in this directory

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

   Or manually:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/service-account.json"
   npm start
   ```

## Endpoints

### POST /notify
Send push notifications to parents of specified students.

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <firebase-id-token>`

**Request Body:**
```json
{
  "title": "Notification Title",
  "body": "Notification message body",
  "studentIds": ["student-id-1", "student-id-2"]
}
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalTokens": 5,
    "successful": 5,
    "failed": 0
  },
  "invalidTokens": []
}
```

### GET /health
Check server status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## How It Works

1. Teacher logs in → FCM token saved to Firestore `users/{teacherId}/fcmTokens`
2. Teacher creates task/marks attendance → Dashboard calls POST /notify
3. Server verifies Firebase ID token
4. Server resolves studentIds → parentPhone → user FCM tokens
5. Server sends batched FCM notifications (500 tokens per batch)
6. Invalid tokens are cleaned up automatically

## Architecture

```
students collection:
{
  id: "student-001",
  parentPhone: "+1234567890",
  ...
}

users collection:
{
  uid: "parent-uid",
  phone: "+1234567890",
  fcmTokens: [
    {
      token: "fcm-token-here",
      device: "Chrome on Mac",
      addedAt: "2024-01-..."
    }
  ]
}
```

## Environment Variables

- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account JSON (required)
- `PORT`: Server port (default: 3001)

## Security

- ✅ Verifies Firebase ID tokens before processing requests
- ✅ Only authenticated teachers can send notifications
- ✅ Service account credentials kept secure (not in git)
- ✅ CORS enabled (restrict in production)

## Error Handling

- Invalid tokens are automatically removed from Firestore
- Failed sends are logged but don't block other notifications
- Detailed error messages in server logs

## Production Deployment

See `../SETUP-NOTIFICATIONS.md` for Cloud Run deployment instructions.

## Troubleshooting

**Error: "Service account not found"**
- Ensure `service-account.json` exists in this directory
- Check GOOGLE_APPLICATION_CREDENTIALS environment variable

**Error: "Unauthorized"**
- Get a fresh Firebase ID token from the web app
- Token expires after 1 hour

**No notifications received?**
- Check browser notification permissions
- Verify FCM tokens are saved in Firestore
- Check server logs for errors

## Development

```bash
# Run with auto-reload
npm run dev

# Check server status
curl http://localhost:3001/health
```
