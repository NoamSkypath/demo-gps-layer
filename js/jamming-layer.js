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
          // Jamming aggregated data - color by severity
          [
            'step',
            ['get', 'ratio_bad'],
            CONFIG.JAMMING.COLOR_SCALE[0].color, // Zero (0%-1%)
            0.01,
            CONFIG.JAMMING.COLOR_SCALE[1].color, // Low (1%-10%)
            0.1,
            CONFIG.JAMMING.COLOR_SCALE[2].color, // High (10%-100%)
          ],
          ['==', ['get', 'coverage'], 'none'],
          // Coverage data with no coverage (red)
          '#dc2626',
          // Coverage data with coverage (default green)
          '#10b981',
        ],
        'fill-opacity': 0.6,
      },
    });

    // Add outline layer (matching fill color)
    this.map.addLayer({
      id: `${this.layerId}-outline`,
      type: 'line',
      source: this.sourceId,
      paint: {
        'line-color': [
          'case',
          ['has', 'ratio_bad'],
          // Jamming aggregated data - color by severity
          [
            'step',
            ['get', 'ratio_bad'],
            CONFIG.JAMMING.COLOR_SCALE[0].color, // Zero (0%-1%)
            0.01,
            CONFIG.JAMMING.COLOR_SCALE[1].color, // Low (1%-10%)
            0.1,
            CONFIG.JAMMING.COLOR_SCALE[2].color, // High (10%-100%)
          ],
          ['==', ['get', 'coverage'], 'none'],
          // Coverage data with no coverage (red)
          '#dc2626',
          // Coverage data with coverage (default green)
          '#10b981',
        ],
        'line-width': 1,
        'line-opacity': 0.8,
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
   * Filter GeoJSON features by severity level (client-side)
   * Severity levels:
   * - zero: 0 <= ratio_bad < 0.01 (0% to <1%)
   * - low: 0.01 <= ratio_bad < 0.1 (1% to <10%)
   * - high: ratio_bad >= 0.1 (10% to 100%)
   */
  filterBySeverity(geojson, severityLevels) {
    // If no levels selected (empty array), show all
    if (!severityLevels || severityLevels.length === 0) {
      return geojson;
    }

    return {
      ...geojson,
      features: geojson.features.filter((feature) => {
        const ratioBad = feature.properties.ratio_bad || 0;

        if (severityLevels.includes('zero') && ratioBad < 0.01) {
          return true;
        }
        if (
          severityLevels.includes('low') &&
          ratioBad >= 0.01 &&
          ratioBad < 0.1
        ) {
          return true;
        }
        if (severityLevels.includes('high') && ratioBad >= 0.1) {
          return true;
        }

        return false;
      }),
    };
  }

  /**
   * Get severity level for a ratio_bad value
   */
  getSeverityLevel(ratioBad) {
    if (ratioBad < 0.01) return 'zero';
    if (ratioBad < 0.1) return 'low';
    return 'high';
  }

  /**
   * Union hexagons by severity level (client-side)
   * Uses Turf.js to merge all hexagons of the same severity into single polygons
   */
  unionBySeverity(geojson) {
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      return geojson;
    }

    // Check if Turf.js is available
    if (typeof turf === 'undefined') {
      console.error('Turf.js is not loaded. Cannot perform union operation.');
      return geojson;
    }

    // Group features by severity level
    const severityGroups = {
      zero: [],
      low: [],
      high: [],
    };

    geojson.features.forEach((feature) => {
      const ratioBad = feature.properties.ratio_bad || 0;
      const severity = this.getSeverityLevel(ratioBad);
      severityGroups[severity].push(feature);
    });

    const unionedFeatures = [];

    // Union each severity group
    Object.keys(severityGroups).forEach((severity) => {
      const features = severityGroups[severity];
      if (features.length === 0) return;

      try {
        if (features.length === 1) {
          // If only one feature, just use it
          unionedFeatures.push(features[0]);
        } else {
          // Union all features in this severity group
          let unionedPolygon = features[0];
          for (let i = 1; i < features.length; i++) {
            unionedPolygon = turf.union(
              turf.featureCollection([unionedPolygon, features[i]])
            );
          }

          // Create a new feature with unioned geometry
          // Keep properties from the first feature, add severity info
          const avgRatioBad =
            features.reduce(
              (sum, f) => sum + (f.properties.ratio_bad || 0),
              0
            ) / features.length;

          unionedFeatures.push({
            type: 'Feature',
            geometry: unionedPolygon.geometry,
            properties: {
              ...features[0].properties,
              ratio_bad: avgRatioBad,
              severity_level: severity,
              unioned_count: features.length,
              unioned: true,
            },
          });
        }
      } catch (error) {
        console.error(`Error unioning ${severity} severity features:`, error);
        // If union fails, add original features
        unionedFeatures.push(...features);
      }
    });

    return {
      type: 'FeatureCollection',
      features: unionedFeatures,
    };
  }

  /**
   * Load jamming data from API
   */
  async loadData(options = {}) {
    try {
      // Determine which API method to call based on data source
      const dataSource = options.dataSource || 'jamming/agg';
      const severityLevels = options.jammingSeverityLevels || [];
      let response;

      if (dataSource === 'jamming/coverage') {
        response = await this.apiClient.getJammingCoverage(options);
      } else {
        response = await this.apiClient.getJammingData(options);
      }

      // Filter by severity (client-side) - only for agg data
      let filteredData =
        dataSource === 'jamming/agg'
          ? this.filterBySeverity(response.data, severityLevels)
          : response.data;

      // Apply union by severity if enabled - only for agg data
      if (dataSource === 'jamming/agg' && options.unionBySeverity === true) {
        filteredData = this.unionBySeverity(filteredData);
      }

      this.currentData = filteredData;
      this.metadata = response.metadata;

      // Update the map source with filtered data
      this.updateSource(this.currentData);

      return {
        data: this.currentData,
        metadata: this.metadata,
        stats: this.calculateStats(this.currentData, dataSource),
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
  calculateStats(geojson, dataSource = 'jamming/agg') {
    if (!geojson || !geojson.features) {
      return {
        totalCells: 0,
        uniqueAircraft: 0,
        highSeverityCells: 0,
      };
    }

    const features = geojson.features;

    // For coverage data, just count areas
    if (dataSource === 'jamming/coverage') {
      return {
        totalCells: features.length,
        uniqueAircraft: 0,
        highSeverityCells: 0,
      };
    }

    // For aggregated data, calculate jamming stats
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

    // Determine if this is coverage data or aggregated data
    const isCoverage =
      props.coverage !== undefined || (!props.ratio_bad && !props.n_unique_ac);

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

    let html = '';

    if (isCoverage) {
      // Coverage popup
      const hasCoverage = props.coverage !== 'none';
      html = `
        <div class="popup-content">
          <h4>Coverage ${hasCoverage ? '✓' : '✗'}</h4>
          ${h3Info}
          <div class="popup-stat">
            <span class="popup-stat-label">Altitude:</span>
            <span class="popup-stat-value">${props.altitude || 'N/A'}</span>
          </div>
          <hr style="margin: 0.5rem 0; border: 1px solid #444;">
          <div class="popup-stat">
            <span class="popup-stat-label">Status:</span>
            <span class="popup-stat-value" style="color: ${
              hasCoverage ? '#10b981' : '#dc2626'
            }">
              ${hasCoverage ? 'Has Coverage' : 'No Coverage'}
            </span>
          </div>
        </div>
      `;
    } else {
      // Jamming aggregated popup
      html = `
        <div class="popup-content">
          <h4>Jamming Details</h4>
          ${h3Info}
          <div class="popup-stat">
            <span class="popup-stat-label">Altitude:</span>
            <span class="popup-stat-value">${props.altitude || 'N/A'}</span>
          </div>
          <hr style="margin: 0.5rem 0; border: 1px solid #444;">
          <div class="popup-stat">
            <span class="popup-stat-label">Total Aircraft:</span>
            <span class="popup-stat-value">${props.n_unique_ac || 0}</span>
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
    }

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
