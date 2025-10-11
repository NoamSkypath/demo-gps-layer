// Map Manager - Handles map initialization and interaction
class MapManager {
  constructor(containerId, config) {
    this.containerId = containerId;
    this.config = config;
    this.map = null;
    this.apiClient = null;
    this.jammingLayer = null;
    this.autoRefreshInterval = null;
  }

  /**
   * Initialize the map
   */
  async initialize() {
    // Set Mapbox access token
    mapboxgl.accessToken = this.config.MAPBOX_TOKEN;

    // Create map
    this.map = new mapboxgl.Map({
      container: this.containerId,
      style: this.config.MAP.STYLE,
      center: this.config.MAP.INITIAL_CENTER,
      zoom: this.config.MAP.INITIAL_ZOOM,
      attributionControl: true,
    });

    // Add navigation controls
    this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add scale control
    this.map.addControl(new mapboxgl.ScaleControl(), 'bottom-right');

    // Wait for map to load
    await new Promise((resolve) => {
      this.map.on('load', resolve);
    });

    // Initialize API client
    this.apiClient = new APIClient(this.config.API);

    // Initialize jamming layer
    this.jammingLayer = new JammingLayer(this.map, this.apiClient);
    this.jammingLayer.initialize();

    console.log('Map initialized successfully');
  }

  /**
   * Load jamming data with current settings
   */
  async loadJammingData(options) {
    try {
      const result = await this.jammingLayer.loadData(options);
      return result;
    } catch (error) {
      console.error('Error loading jamming data:', error);
      throw error;
    }
  }

  /**
   * Toggle jamming layer visibility
   */
  toggleJammingLayer(visible) {
    if (this.jammingLayer) {
      this.jammingLayer.setVisibility(visible);
    }
  }

  /**
   * Start auto-refresh
   */
  startAutoRefresh(callback, interval) {
    this.stopAutoRefresh();
    this.autoRefreshInterval = setInterval(callback, interval);
    console.log(`Auto-refresh started (every ${interval / 1000}s)`);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
      console.log('Auto-refresh stopped');
    }
  }

  /**
   * Get current map bounds
   */
  getBounds() {
    return this.map.getBounds();
  }

  /**
   * Fit map to data bounds
   */
  fitToData(padding = 50) {
    if (!this.jammingLayer || !this.jammingLayer.currentData) {
      return;
    }

    const features = this.jammingLayer.currentData.features;
    if (features.length === 0) {
      return;
    }

    // Calculate bounds
    const bounds = new mapboxgl.LngLatBounds();
    features.forEach((feature) => {
      if (feature.geometry.type === 'Polygon') {
        feature.geometry.coordinates[0].forEach((coord) => {
          bounds.extend(coord);
        });
      }
    });

    this.map.fitBounds(bounds, { padding });
  }

  /**
   * Toggle map projection between globe and mercator
   */
  toggleProjection() {
    const currentProjection = this.map.getProjection();
    const newProjection =
      currentProjection.name === 'globe' ? 'mercator' : 'globe';

    this.map.setProjection(newProjection);

    return newProjection;
  }

  /**
   * Get current projection
   */
  getProjection() {
    return this.map.getProjection().name;
  }
}
