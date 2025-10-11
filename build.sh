#!/bin/bash

# Build script to inject environment variables into the app
# This script reads from .env file (local) or environment variables (GitHub Actions)

set -e

echo "🔨 Building GPS Jamming Layer Demo..."

# Load .env if it exists (for local development)
if [ -f .env ]; then
    echo "📝 Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check required variables
if [ -z "$MAPBOX_TOKEN" ]; then
    echo "❌ Error: MAPBOX_TOKEN is not set"
    exit 1
fi

if [ -z "$API_BASE_URL" ]; then
    echo "❌ Error: API_BASE_URL is not set"
    exit 1
fi

# Note: API_KEY and CLIENT_ID are not needed in the client
# Authentication is handled by the proxy server

# Create dist directory
mkdir -p dist
echo "📁 Created dist directory"

# Copy all files to dist
cp -r index.html css js dist/
echo "📋 Copied source files to dist/"

# Replace placeholders in config.js
CONFIG_FILE="dist/js/config.js"
echo "🔧 Injecting environment variables into config.js..."

sed -i.bak "s|MAPBOX_TOKEN_PLACEHOLDER|${MAPBOX_TOKEN}|g" "$CONFIG_FILE"
sed -i.bak "s|API_BASE_URL_PLACEHOLDER|${API_BASE_URL}|g" "$CONFIG_FILE"

# Remove backup file
rm "${CONFIG_FILE}.bak"

echo "✅ Build complete! Files are in dist/ directory"
echo ""
echo "📦 To deploy:"
echo "   1. Commit the dist/ directory"
echo "   2. Push to GitHub"
echo "   3. Enable GitHub Pages from the dist/ folder"
echo ""
echo "🌐 Or test locally:"
echo "   cd dist && python3 -m http.server 5151"

