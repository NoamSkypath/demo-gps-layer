// Jamming Layer Manager
class JammingLayer {
  constructor(map, apiClient) {
    this.map = map;
    this.apiClient = apiClient;
    this.sourceId = 'jamming-source';
    this.layerId = 'jamming-layer';
    this.currentData = null;
    this.metadata = null;
    this.visible = true;
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

    // Add fill layer
    this.map.addLayer({
      id: this.layerId,
      type: 'fill',
      source: this.sourceId,
      paint: {
        'fill-color': [
          'case',
          ['has', 'ratio_bad'],
          [
            'step',
            ['get', 'ratio_bad'],
            CONFIG.JAMMING.COLOR_SCALE[0].color, // 0-5%
            0.05,
            CONFIG.JAMMING.COLOR_SCALE[1].color, // 5-15%
            0.15,
            CONFIG.JAMMING.COLOR_SCALE[2].color, // 15-30%
            0.3,
            CONFIG.JAMMING.COLOR_SCALE[3].color, // 30%+
          ],
          '#cccccc', // fallback
        ],
        'fill-opacity': 0.6,
      },
    });

    // Add outline layer
    this.map.addLayer({
      id: `${this.layerId}-outline`,
      type: 'line',
      source: this.sourceId,
      paint: {
        'line-color': '#ffffff',
        'line-width': 1,
        'line-opacity': 0.3,
      },
    });

    // Add hover effect
    this.map.on('mouseenter', this.layerId, () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });

    this.map.on('mouseleave', this.layerId, () => {
      this.map.getCanvas().style.cursor = '';
    });

    // Add click handler for popup
    this.map.on('click', this.layerId, (e) => {
      if (e.features && e.features.length > 0) {
        this.showPopup(e.features[0], e.lngLat);
      }
    });
  }

  /**
   * Load jamming data from API
   */
  async loadData(options = {}) {
    try {
      const response = await this.apiClient.getJammingData(options);
      this.currentData = response.data;
      this.metadata = response.metadata;

      // Update the map source
      this.updateSource(this.currentData);

      return {
        data: this.currentData,
        metadata: this.metadata,
        stats: this.calculateStats(this.currentData),
      };
    } catch (error) {
      console.error('Failed to load jamming data:', error);
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
    let totalUniqueAircraft = 0;
    let highSeverityCells = 0;

    features.forEach((feature) => {
      const props = feature.properties;
      if (props.n_unique_ac) {
        totalUniqueAircraft += props.n_unique_ac;
      }
      if (props.ratio_bad >= 0.3) {
        highSeverityCells++;
      }
    });

    return {
      totalCells: features.length,
      uniqueAircraft: totalUniqueAircraft,
      highSeverityCells,
    };
  }

  /**
   * Show popup for a feature
   */
  showPopup(feature, lngLat) {
    const props = feature.properties;

    let h3Info = '';
    if (props.h3_indices && Array.isArray(props.h3_indices)) {
      h3Info = `<div class="popup-stat">
                <span class="popup-stat-label">Cells in Group:</span>
                <span class="popup-stat-value">${props.h3_indices.length}</span>
            </div>`;
    } else if (props.h3_index) {
      h3Info = `<div class="popup-stat">
                <span class="popup-stat-label">H3 Index:</span>
                <span class="popup-stat-value">${props.h3_index}</span>
            </div>`;
    }

    const html = `
            <div class="popup-content">
                <h4>Jamming Details</h4>
                ${h3Info}
                <div class="popup-stat">
                    <span class="popup-stat-label">Altitude:</span>
                    <span class="popup-stat-value">${
                      props.altitude || 'N/A'
                    }</span>
                </div>
                <hr style="margin: 0.5rem 0; border: 1px solid #444;">
                <div class="popup-stat">
                    <span class="popup-stat-label">Total Aircraft:</span>
                    <span class="popup-stat-value">${
                      props.n_unique_ac || 0
                    }</span>
                </div>
                <div class="popup-stat">
                    <span class="popup-stat-label">Good (NIC 8-11):</span>
                    <span class="popup-stat-value">${props.n_good || 0}</span>
                </div>
                <div class="popup-stat">
                    <span class="popup-stat-label">Bad (NIC 0):</span>
                    <span class="popup-stat-value">${props.n_bad || 0}</span>
                </div>
                <div class="popup-stat">
                    <span class="popup-stat-label">Severity:</span>
                    <span class="popup-stat-value">${formatPercentage(
                      props.ratio_bad || 0
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
    this.map.setLayoutProperty(this.layerId, 'visibility', visibility);
    this.map.setLayoutProperty(
      `${this.layerId}-outline`,
      'visibility',
      visibility
    );
  }

  /**
   * Clear all data
   */
  clear() {
    this.updateSource({
      type: 'FeatureCollection',
      features: [],
    });
    this.currentData = null;
    this.metadata = null;
  }
}
