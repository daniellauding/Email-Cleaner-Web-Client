#!/bin/bash

echo "🚀 Email Cleaner Setup Script"
echo "=============================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. You have $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"

# Setup environment file
echo ""
echo "🔧 Setting up environment..."

if [ ! -f .env.local ]; then
    cp .env.local.example .env.local
    echo "✅ Created .env.local file"
    echo ""
    echo "🚨 IMPORTANT: You need to configure .env.local with your Google OAuth credentials!"
    echo ""
    echo "Next steps:"
    echo "1. Go to https://console.cloud.google.com/"
    echo "2. Create a new project or select existing"
    echo "3. Enable Gmail API"
    echo "4. Create OAuth 2.0 credentials"
    echo "5. Add your credentials to .env.local"
    echo "6. Run: npm run dev"
    echo ""
    echo "📚 See README.md for detailed setup instructions"
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "📱 The app is mobile-first and works great on phones!"
echo "🤖 Don't forget to check out the n8n webhook endpoints for automation!"