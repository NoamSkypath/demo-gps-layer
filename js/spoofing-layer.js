// Spoofing Layer Manager
class SpoofingLayer {
  constructor(map, apiClient) {
    this.map = map;
    this.apiClient = apiClient;
    this.sourceId = 'spoofing-source';
    this.lineLayerId = 'spoofing-line-layer';
    this.pointLayerId = 'spoofing-point-layer';
    this.h3LayerId = 'spoofing-h3-layer';
    this.h3OutlineLayerId = 'spoofing-h3-outline-layer';
    this.currentData = null;
    this.metadata = null;
    this.visible = true;
    this.currentMode = 'agg'; // 'agg' or 'h3'
  }

  /**
   * Initialize the layer on the map
   */
  initialize() {
    // Add empty source
    this.map.addSource(this.sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    // Add line layer for trajectories (before-during, during-after, before-during-after)
    this.map.addLayer({
      id: this.lineLayerId,
      type: 'line',
      source: this.sourceId,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': '#f59e0b', // Amber color for spoofing
        'line-width': 3,
        'line-opacity': 0.8,
      },
    });

    // Add point layer for single events (during only)
    this.map.addLayer({
      id: this.pointLayerId,
      type: 'circle',
      source: this.sourceId,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 6,
        'circle-color': '#dc2626', // Red for spoofing events
        'circle-opacity': 0.8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.5,
      },
    });

    // Add H3 polygon fill layer (for H3 grid mode)
    this.map.addLayer({
      id: this.h3LayerId,
      type: 'fill',
      source: this.sourceId,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'count'],
          1,
          '#fef3c7', // Very light yellow for low counts
          5,
          '#fbbf24', // Medium yellow
          10,
          '#f59e0b', // Amber
          20,
          '#d97706', // Dark amber
          50,
          '#dc2626', // Red for high counts
        ],
        'fill-opacity': 0.6,
      },
    });

    // Add H3 polygon outline layer
    this.map.addLayer({
      id: this.h3OutlineLayerId,
      type: 'line',
      source: this.sourceId,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'line-color': '#374151',
        'line-width': 1,
        'line-opacity': 0.3,
      },
    });

    // Add hover effects for lines
    this.map.on('mouseenter', this.lineLayerId, () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });

    this.map.on('mouseleave', this.lineLayerId, () => {
      this.map.getCanvas().style.cursor = '';
    });

    // Add hover effects for points
    this.map.on('mouseenter', this.pointLayerId, () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });

    this.map.on('mouseleave', this.pointLayerId, () => {
      this.map.getCanvas().style.cursor = '';
    });

    // Add click handlers for popup
    this.map.on('click', this.lineLayerId, (e) => {
      if (e.features && e.features.length > 0) {
        this.showPopup(e.features[0], e.lngLat);
      }
    });

    this.map.on('click', this.pointLayerId, (e) => {
      if (e.features && e.features.length > 0) {
        this.showPopup(e.features[0], e.lngLat);
      }
    });

    // Add hover effects for H3 polygons
    this.map.on('mouseenter', this.h3LayerId, () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });

    this.map.on('mouseleave', this.h3LayerId, () => {
      this.map.getCanvas().style.cursor = '';
    });

    // Add click handler for H3 polygons
    this.map.on('click', this.h3LayerId, (e) => {
      if (e.features && e.features.length > 0) {
        this.showPopup(e.features[0], e.lngLat);
      }
    });
  }

  /**
   * Load spoofing data from API
   */
  async loadData(options = {}) {
    try {
      // Determine mode based on dataSource (for stats calculation)
      const isH3 = options.dataSource === 'spoofing/h3';
      const showBoth = options.showBothSpoofingLayers === true;

      // Set mode based on selected dataSource (not whether both are shown)
      this.currentMode = isH3 ? 'h3' : 'agg';

      if (showBoth) {
        // Load both agg and H3 data for display
        const [aggResponse, h3Response] = await Promise.all([
          this.apiClient.getSpoofingData(options),
          this.apiClient.getSpoofingH3Data(options),
        ]);

        // Merge the two GeoJSON feature collections for display
        this.currentData = {
          type: 'FeatureCollection',
          features: [...aggResponse.data.features, ...h3Response.data.features],
        };

        // Keep separate data for stats calculation based on selected endpoint
        const statsData = isH3 ? h3Response.data : aggResponse.data;
        this.metadata = isH3 ? h3Response.metadata : aggResponse.metadata;

        // Update the map source with merged data
        this.updateSource(this.currentData);

        return {
          data: this.currentData,
          metadata: this.metadata,
          stats: this.calculateStats(statsData), // Calculate from selected endpoint only
        };
      } else {
        // Single layer mode (original behavior)
        const response = isH3
          ? await this.apiClient.getSpoofingH3Data(options)
          : await this.apiClient.getSpoofingData(options);

        this.currentData = response.data;
        this.metadata = response.metadata;

        // Update the map source
        this.updateSource(this.currentData);

        return {
          data: this.currentData,
          metadata: this.metadata,
          stats: this.calculateStats(this.currentData),
        };
      }
    } catch (error) {
      console.error('Failed to load spoofing data:', error);
      throw error;
    }
  }

  /**
   * Update the map source with new data
   */
  updateSource(geojson) {
    const source = this.map.getSource(this.sourceId);
    if (source) {
      source.setData(geojson);
    }
  }

  /**
   * Calculate statistics from the data
   */
  calculateStats(geojson) {
    if (!geojson || !geojson.features) {
      return {
        totalCells: 0,
        uniqueAircraft: 0,
        highSeverityCells: 0,
      };
    }

    const features = geojson.features;

    if (this.currentMode === 'h3') {
      // H3 mode: count cells and total affected flights
      let totalAffected = 0;
      let highCountCells = 0;

      features.forEach((feature) => {
        const count = feature.properties.count || 0;
        totalAffected += count;
        if (count >= 10) {
          highCountCells++;
        }
      });

      return {
        totalCells: features.length,
        totalAffected: totalAffected,
        highCountCells: highCountCells,
      };
    } else {
      // Agg mode: count unique flights and aircraft
      const uniqueFlights = new Set();
      const uniqueAircraft = new Set();

      features.forEach((feature) => {
        const props = feature.properties;
        if (props.flight_id) {
          uniqueFlights.add(props.flight_id);
        }
        if (props.icao24) {
          uniqueAircraft.add(props.icao24);
        }
      });

      return {
        totalCells: features.length, // Total spoofing events
        uniqueAircraft: uniqueAircraft.size,
        highSeverityCells: uniqueFlights.size, // Reuse as unique flights
      };
    }
  }

  /**
   * Show popup for a feature
   */
  showPopup(feature, lngLat) {
    const props = feature.properties;

    // Check if this is an H3 cell (check for count property)
    if (props.count !== undefined) {
      // H3 cell popup - try multiple locations for H3 index
      const h3Index =
        feature.id || props.id || props.h3_index || props.h3Index || 'N/A';

      const html = `
        <div class="popup-content">
          <h4>🔷 Spoofing H3 Cell</h4>
          <div class="popup-stat">
            <span class="popup-stat-label">H3 Index:</span>
            <span class="popup-stat-value" style="font-size: 0.85rem; word-break: break-all;">${h3Index}</span>
          </div>
          <div class="popup-stat">
            <span class="popup-stat-label">Affected Flights:</span>
            <span class="popup-stat-value">${props.count || 0}</span>
          </div>
          <div class="popup-stat">
            <span class="popup-stat-label">Coordinates Source:</span>
            <span class="popup-stat-value">${
              props.coordinates_source || 'N/A'
            }</span>
          </div>
        </div>
      `;
      new mapboxgl.Popup().setLngLat(lngLat).setHTML(html).addTo(this.map);
      return;
    }

    // Format timestamps for flight events
    const formatTime = (timestamp) => {
      if (!timestamp) return 'N/A';
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short',
      });
    };

    const formatAltitude = (alt) => {
      if (alt === null || alt === undefined) return 'N/A';
      return `${Math.round(alt).toLocaleString()} ft`;
    };

    const formatTrack = (track) => {
      if (track === null || track === undefined) return 'N/A';
      return `${track.toFixed(1)}°`;
    };

    // Flight event popup
    const html = `
      <div class="popup-content">
        <h4>🛩️ Spoofing Event</h4>
        <div class="popup-stat">
          <span class="popup-stat-label">Flight ID:</span>
          <span class="popup-stat-value">${props.flight_id || 'N/A'}</span>
        </div>
        <div class="popup-stat">
          <span class="popup-stat-label">ICAO24:</span>
          <span class="popup-stat-value">${props.icao24 || 'N/A'}</span>
        </div>
        <div class="popup-stat">
          <span class="popup-stat-label">Segment:</span>
          <span class="popup-stat-value">${props.segment || 'N/A'}</span>
        </div>
        <hr style="margin: 0.5rem 0; border: 1px solid #444;">
        <div class="popup-stat">
          <span class="popup-stat-label">During Period:</span>
          <span class="popup-stat-value">${formatTime(
            props.timestamp_during_min
          )}</span>
        </div>
        <div class="popup-stat">
          <span class="popup-stat-label">Duration:</span>
          <span class="popup-stat-value">${
            props.timestamp_during_min && props.timestamp_during_max
              ? Math.round(
                  (new Date(props.timestamp_during_max) -
                    new Date(props.timestamp_during_min)) /
                    1000
                ) + 's'
              : 'N/A'
          }</span>
        </div>
        <div class="popup-stat">
          <span class="popup-stat-label">Altitude (During):</span>
          <span class="popup-stat-value">${formatAltitude(
            props.altitude_during
          )}</span>
        </div>
        <div class="popup-stat">
          <span class="popup-stat-label">Track (During):</span>
          <span class="popup-stat-value">${formatTrack(
            props.track_during
          )}</span>
        </div>
      </div>
    `;

    new mapboxgl.Popup().setLngLat(lngLat).setHTML(html).addTo(this.map);
  }

  /**
   * Toggle layer visibility
   */
  setVisibility(visible) {
    this.visible = visible;
    const visibility = visible ? 'visible' : 'none';

    if (this.map.getLayer(this.lineLayerId)) {
      this.map.setLayoutProperty(this.lineLayerId, 'visibility', visibility);
    }

    if (this.map.getLayer(this.pointLayerId)) {
      this.map.setLayoutProperty(this.pointLayerId, 'visibility', visibility);
    }

    if (this.map.getLayer(this.h3LayerId)) {
      this.map.setLayoutProperty(this.h3LayerId, 'visibility', visibility);
    }

    if (this.map.getLayer(this.h3OutlineLayerId)) {
      this.map.setLayoutProperty(
        this.h3OutlineLayerId,
        'visibility',
        visibility
      );
    }
  }
}
