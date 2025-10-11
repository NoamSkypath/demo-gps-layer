// Configuration
const CONFIG = {
  // Mapbox token - will be injected from environment variable during build
  MAPBOX_TOKEN: 'MAPBOX_TOKEN_PLACEHOLDER',

  // API Configuration
  // Note: Authentication is handled by the proxy server
  // No credentials needed on the client side
  API: {
    BASE_URL: 'API_BASE_URL_PLACEHOLDER',
  },

  // Map Configuration
  MAP: {
    STYLE: 'mapbox://styles/mapbox/dark-v11',
    INITIAL_CENTER: [0, 30], // [lng, lat]
    INITIAL_ZOOM: 2,
    ATTRIBUTION: 'GPS Jamming Data © SkAI Data Services',
  },

  // Jamming Layer Configuration
  JAMMING: {
    DEFAULT_LOOKBACK_HOURS: 6,
    DEFAULT_ALTITUDE: 'FL100-FL450',
    DEFAULT_GROUPED: false,
    DEFAULT_N_OBS_MIN: 5,
    AUTO_REFRESH_INTERVAL: 15 * 60 * 1000, // 15 minutes in milliseconds

    // Color scale for ratio_bad (severity)
    COLOR_SCALE: [
      { threshold: 0, color: '#FEF3C7', label: '0-5% Minimal' },
      { threshold: 0.05, color: '#FED7AA', label: '5-15% Low' },
      { threshold: 0.15, color: '#FB923C', label: '15-30% Moderate' },
      { threshold: 0.3, color: '#DC2626', label: '30%+ High' },
    ],
  },
};

// Helper function to get color based on ratio_bad
function getColorForRatio(ratio) {
  const scale = CONFIG.JAMMING.COLOR_SCALE;
  for (let i = scale.length - 1; i >= 0; i--) {
    if (ratio >= scale[i].threshold) {
      return scale[i].color;
    }
  }
  return scale[0].color;
}

// Helper function to format timestamp
function formatTimestamp(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

// Helper function to format percentage
function formatPercentage(ratio) {
  return (ratio * 100).toFixed(1) + '%';
}
