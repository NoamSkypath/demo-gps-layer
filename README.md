# GPS Jamming Layer - Demo

A web-based visualization of GPS jamming/spoofing data using SkAI GNSS Interference API, rendered on H3 hexagons with Mapbox GL JS.

## 🎯 Features

- **Interactive Map**: Visualize GPS jamming data on H3 hexagons
- **Dynamic Filtering**: Adjustable time lookback (1-72 hours), altitude bands, and grouping
- **Real-time Statistics**: Track cells, affected aircraft, and severity
- **Auto-refresh**: Data updates every 15 minutes
- **Click Interaction**: Detailed popup information for each hexagon

## 🚀 Quick Start - Local Development

### Prerequisites

- Node.js 18+ (for proxy server)
- Python 3 (for web server)
- Mapbox access token
- SkAI API credentials (API Key + Client ID)

### Setup

1. **Create `.env` file**

```bash
# In demo-gps-layer directory
cat > .env << 'EOF'
MAPBOX_TOKEN=your_mapbox_token_here
API_BASE_URL=http://localhost:3333
API_KEY=your_api_key_here
CLIENT_ID=your_client_id_here
EOF
```

2. **Build the application**

```bash
./build.sh
```

3. **Run both servers**

**Terminal 1 - Proxy Server (port 3333):**

```bash
node proxy-server.js
```

**Terminal 2 - Web App (port 5151):**

```bash
cd dist
python3 -m http.server 5151
```

4. **Open in browser**

Visit: **http://localhost:5151**

### Architecture

```
Browser (localhost:5151)
    ↓ API calls
Proxy Server (localhost:3333)
    ↓ adds credentials
SkAI API (gpswise.aero)
```

**Why a proxy server?**

- Authentication happens server-side only (secure)
- Handles CORS for local development
- No credentials exposed in client code

## 📦 Deploy to GitHub Pages

### 1. Setup GitHub Secrets

Go to: Settings → Secrets and variables → Actions

Add these secrets:

- `MAPBOX_TOKEN`
- `API_BASE_URL` (use your production Lambda URL or direct API)
- `API_KEY` (optional if using Lambda)
- `CLIENT_ID` (optional if using Lambda)

### 2. Enable GitHub Pages

Go to: Settings → Pages  
Source: **GitHub Actions**

### 3. Deploy

```bash
git add .
git commit -m "Deploy GPS Jamming Layer"
git push origin main
```

The GitHub Actions workflow will build and deploy automatically.

## 🗂️ Project Structure

```
demo-gps-layer/
├── index.html              # Main HTML
├── proxy-server.js         # Local dev proxy (adds credentials)
├── build.sh                # Build script (injects env vars)
├── css/
│   └── style.css          # Styles
├── js/
│   ├── config.js          # Configuration
│   ├── api-client.js      # API client
│   ├── jamming-layer.js   # Layer management
│   ├── map-manager.js     # Map controls
│   └── app.js             # Main app
├── dist/                  # Built files (generated)
└── .github/
    └── workflows/
        └── deploy.yml     # GitHub Actions workflow
```

## 🎨 Color Scale

Jamming severity based on `ratio_bad` (% of aircraft with bad NIC):

- 🟨 **0-5%**: Minimal (Light Yellow)
- 🟧 **5-15%**: Low (Peach)
- 🟠 **15-30%**: Moderate (Orange)
- 🔴 **30%+**: High (Red)

## 📊 API Endpoints Used

- **Jamming Data**: `GET /db-api/v1/jamming/agg`
  - Returns H3 hexagons with NIC statistics
  - Parameters: `lookback_hours`, `altitudes`, `grouped`, `n_obs_min`

See [SkAI GNSS Interference API docs](https://gpswise.aero/docs) for details.

## 🐛 Troubleshooting

### Local Development

**Port already in use?**

```bash
# Kill processes on ports 3333 and 5151
lsof -ti:3333,5151 | xargs kill -9

# Restart servers
node proxy-server.js &
cd dist && python3 -m http.server 5151
```

**Map not loading?**

- Check `MAPBOX_TOKEN` in `.env`
- Check browser console (F12) for errors

**No data showing?**

- Verify API credentials in `.env`
- Check proxy server logs
- Check Network tab in browser DevTools
- Try different altitude bands or lookback hours

**CORS errors?**

- Make sure proxy server is running on port 3333
- Check `API_BASE_URL=http://localhost:3333` in `.env`
- Rebuild: `./build.sh`

### GitHub Pages Deployment

**Build fails?**

- Verify all GitHub Secrets are set
- Check secret names match exactly (case-sensitive)

**Deployed but no data?**

- For production, you need a Lambda proxy or direct API access
- Update `API_BASE_URL` secret to your production endpoint

## 🔧 Configuration

Edit `js/config.js` to customize:

- Default lookback hours
- Default altitude band
- Color scale thresholds
- Auto-refresh interval
- Map initial view

## 📄 License

Internal POC - SkyPath Team

## 🤝 Contact

For questions or improvements, contact the development team.
