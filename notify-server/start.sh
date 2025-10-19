#!/bin/bash
# Quick start script for FLED notification server

echo "🚀 Starting FLED Notification Server..."
echo ""

# Check if service account exists
if [ ! -f "service-account.json" ]; then
    echo "❌ Error: service-account.json not found!"
    echo ""
    echo "Please follow these steps:"
    echo "1. Go to Firebase Console > Project Settings > Service Accounts"
    echo "2. Click 'Generate new private key'"
    echo "3. Save the file as 'service-account.json' in this directory"
    echo ""
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/service-account.json"

echo "✅ Service account loaded"
echo "✅ Starting server on port 3001..."
echo ""

# Start the server
npm start
