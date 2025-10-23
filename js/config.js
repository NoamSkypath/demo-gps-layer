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
    DEFAULT_LOOKBACK_HOURS: 24,
    DEFAULT_ALTITUDE: 'FL100-FL450',
    DEFAULT_GROUPED: false,
    DEFAULT_N_OBS_MIN: 5,
    AUTO_REFRESH_INTERVAL: 15 * 60 * 1000, // 15 minutes in milliseconds

    // Color scale for ratio_bad (severity) - 3 levels
    COLOR_SCALE: [
      { threshold: 0, color: '#E5E7EB', label: 'Zero (0%-1%)' }, // Gray for zero to <1%
      { threshold: 0.01, color: '#FCD34D', label: 'Low (1%-10%)' }, // Yellow for 1% to <10%
      { threshold: 0.1, color: '#DC2626', label: 'High (10%-100%)' }, // Red for 10%+
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
