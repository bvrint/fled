#!/bin/bash
# Test notification sender for FLED
# This sends a test notification to verify the system works

echo "🧪 FLED Notification Test Script"
echo "=================================="
echo ""

# Check if notify server is running
if ! curl -s http://localhost:3000/health > /dev/null; then
    echo "❌ Error: Notify server is not running on port 3000"
    echo ""
    echo "Start it with:"
    echo "  cd notify-server && ./start.sh"
    exit 1
fi

echo "✅ Notify server is running"
echo ""

# Prompt for Firebase ID token
echo "📝 Step 1: Get your Firebase ID token"
echo ""
echo "1. Open: https://fledd-2e273.web.app/teacher/login.html"
echo "2. Sign in with Google and allow notifications"
echo "3. Open browser console (F12 or Cmd+Option+I)"
echo "4. Run this command:"
echo ""
echo "   firebase.auth().currentUser.getIdToken().then(token => console.log(token))"
echo ""
echo "5. Copy the long token string"
echo ""
read -p "Paste your Firebase ID token here: " ID_TOKEN

if [ -z "$ID_TOKEN" ]; then
    echo "❌ No token provided"
    exit 1
fi

echo ""
echo "📝 Step 2: Get your user ID (optional - for targeted test)"
echo ""
read -p "Paste your Firebase user ID (or press Enter to skip): " USER_ID

echo ""
echo "🚀 Sending test notification..."
echo ""

# Send notification
RESPONSE=$(curl -s -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d "{
    \"title\": \"🎉 FLED Test Notification\",
    \"body\": \"If you see this, your notification system is working perfectly!\",
    \"studentIds\": []
  }")

echo "Response from server:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if successful
if echo "$RESPONSE" | grep -q '"success".*true'; then
    echo "✅ SUCCESS! Check your browser for the notification!"
    echo ""
    echo "You should see a notification pop up that says:"
    echo "  '🎉 FLED Test Notification'"
    echo "  'If you see this, your notification system is working perfectly!'"
    echo ""
else
    echo "❌ Something went wrong. Check the error message above."
    echo ""
    echo "Common issues:"
    echo "  - Token expired (get a fresh one)"
    echo "  - Not signed in to web app"
    echo "  - Notifications not allowed in browser"
    echo "  - FCM token not saved to Firestore"
fi

echo ""
echo "Check notify server logs for more details"
