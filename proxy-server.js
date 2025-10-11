#!/usr/bin/env node

/**
 * Local CORS Proxy Server for SkAI API
 *
 * For local development: Run with Node.js
 * For AWS Lambda: Use the same logic in Lambda handler
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
const TARGET_API = 'https://gpswise.aero';

// Load environment variables from .env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');

  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env file not found');
    console.error('   Please create .env file with API_KEY and CLIENT_ID');
    process.exit(1);
  }

  const env = {};
  const content = fs.readFileSync(envPath, 'utf8');

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }

  // Validate required variables
  if (!env.API_KEY || !env.CLIENT_ID) {
    console.error('❌ Error: Missing required environment variables');
    console.error('   Required: API_KEY and CLIENT_ID in .env file');
    process.exit(1);
  }

  return env;
}

const ENV = loadEnv();

// Proxy request handler
function proxyRequest(targetUrl, req, res) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: req.method,
      headers: {
        'X-API-Key': ENV.API_KEY,
        'X-Client-ID': ENV.CLIENT_ID,
        Accept: 'application/json',
        'User-Agent': 'SkAI-Proxy/1.0',
      },
    };

    console.log(`📡 ${req.method} ${targetUrl}`);

    const apiReq = https.request(options, (apiRes) => {
      console.log(`✅ ${apiRes.statusCode} ${apiRes.statusMessage}`);

      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Content-Type', 'application/json');

      // Forward important headers from SkAI
      if (apiRes.headers['x-period-start']) {
        res.setHeader('x-period-start', apiRes.headers['x-period-start']);
      }
      if (apiRes.headers['x-period-end']) {
        res.setHeader('x-period-end', apiRes.headers['x-period-end']);
      }

      // Set status code
      res.statusCode = apiRes.statusCode;

      // Pipe response
      apiRes.pipe(res);

      apiRes.on('end', () => resolve());
    });

    apiReq.on('error', (error) => {
      console.error('❌ API request error:', error.message);

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 502;
      res.end(
        JSON.stringify({
          error: 'Failed to connect to SkAI API',
          message: error.message,
        })
      );

      reject(error);
    });

    // Forward request body if present
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(apiReq);
    } else {
      apiReq.end();
    }
  });
}

// Main HTTP server
const server = http.createServer(async (req, res) => {
  // Log request
  console.log(`\n🔵 ${req.method} ${req.url}`);
  console.log(req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.statusCode = 204;
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/' || req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'SkAI API Proxy',
        target: TARGET_API,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Only proxy /db-api/* paths
  if (!req.url.startsWith('/db-api/')) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 404;
    res.end(
      JSON.stringify({
        error: 'Not found',
        message: 'This proxy only handles /db-api/* paths',
        hint: 'Try: http://localhost:3333/db-api/v1/spoofing/agg/sample',
      })
    );
    return;
  }

  // Build target URL
  const targetUrl = `${TARGET_API}${req.url}`;

  try {
    await proxyRequest(targetUrl, req, res);
  } catch (error) {
    // Error already handled in proxyRequest
  }
});

// Start server
server.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('🚀 SkAI API Proxy Server');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log(`📍 Local:     http://localhost:${PORT}`);
  console.log(`🎯 Target:    ${TARGET_API}`);
  console.log(`🔑 API Key:   ${ENV.API_KEY.substring(0, 10)}...`);
  console.log(`👤 Client ID: ${ENV.CLIENT_ID}`);
  console.log('');
  console.log('✅ Server is running!');
  console.log('');
  console.log('📝 Next steps:');
  console.log('   1. Keep this terminal open');
  console.log('   2. Update your app to use: http://localhost:3333');
  console.log(
    '   3. Test: http://localhost:3333/db-api/v1/spoofing/agg/sample'
  );
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down proxy server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down proxy server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
