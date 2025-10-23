// Map Manager - Handles map initialization and interaction
class MapManager {
  constructor(containerId, config) {
    this.containerId = containerId;
    this.config = config;
    this.map = null;
    this.apiClient = null;
    this.jammingLayer = null;
    this.spoofingLayer = null;
    this.currentLayerType = 'jamming'; // 'jamming' or 'spoofing'
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

    // Add scale control (zoom controls disabled per user request)
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

    // Initialize spoofing layer
    this.spoofingLayer = new SpoofingLayer(this.map, this.apiClient);
    this.spoofingLayer.initialize();
    this.spoofingLayer.setVisibility(false); // Hidden by default

    console.log('Map initialized successfully');
  }

  /**
   * Load data with current settings (supports both jamming and spoofing)
   */
  async loadJammingData(options) {
    try {
      const dataSource = options.dataSource || 'jamming/agg';
      const isSpoofing = dataSource.startsWith('spoofing/');

      // Switch layer visibility
      if (isSpoofing && this.currentLayerType !== 'spoofing') {
        this.jammingLayer.setVisibility(false);
        this.spoofingLayer.setVisibility(true);
        this.currentLayerType = 'spoofing';
      } else if (!isSpoofing && this.currentLayerType !== 'jamming') {
        this.spoofingLayer.setVisibility(false);
        this.jammingLayer.setVisibility(true);
        this.currentLayerType = 'jamming';
      }

      // Load data from appropriate layer
      let result;
      if (isSpoofing) {
        result = await this.spoofingLayer.loadData(options);
      } else {
        result = await this.jammingLayer.loadData(options);
      }

      return result;
    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  }

  /**
   * Toggle current layer visibility
   */
  toggleJammingLayer(visible) {
    if (this.currentLayerType === 'jamming' && this.jammingLayer) {
      this.jammingLayer.setVisibility(visible);
    } else if (this.currentLayerType === 'spoofing' && this.spoofingLayer) {
      this.spoofingLayer.setVisibility(visible);
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
    const currentLayer =
      this.currentLayerType === 'spoofing'
        ? this.spoofingLayer
        : this.jammingLayer;

    if (!currentLayer || !currentLayer.currentData) {
      return;
    }

    const features = currentLayer.currentData.features;
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
      } else if (feature.geometry.type === 'LineString') {
        feature.geometry.coordinates.forEach((coord) => {
          bounds.extend(coord);
        });
      } else if (feature.geometry.type === 'Point') {
        bounds.extend(feature.geometry.coordinates);
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
