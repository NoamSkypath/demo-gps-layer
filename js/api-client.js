// API Client for SkAI GNSS Interference API
class APIClient {
  constructor(config) {
    this.baseUrl = config.BASE_URL;
    // Note: Authentication is handled by the proxy server
    // No credentials needed on the client side
  }

  /**
   * Build headers for requests
   */
  _buildHeaders() {
    return {
      Accept: 'application/json',
    };
  }

  /**
   * Make a GET request to the API
   */
  async _get(endpoint, params = {}) {
    const url = new URL(endpoint, this.baseUrl);

    // Add query parameters
    Object.keys(params).forEach((key) => {
      if (params[key] !== null && params[key] !== undefined) {
        url.searchParams.append(key, params[key]);
      }
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this._buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }

      // Get headers for metadata
      const periodStart = response.headers.get('x-period-start');
      const periodEnd = response.headers.get('x-period-end');

      const data = await response.json();

      return {
        data,
        metadata: {
          periodStart,
          periodEnd,
          status: response.status,
          url: url.toString(),
        },
      };
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  /**
   * Get jamming aggregated data
   * @param {Object} options - Query parameters
   * @returns {Promise<Object>} GeoJSON FeatureCollection with metadata
   */
  async getJammingData(options = {}) {
    const {
      lookback_hours = 6,
      altitudes = 'FL100-FL450',
      altitude_summed = false,
      hours_summed = true,
      n_obs_min = 5,
      grouped = false,
      full_output = false,
      max_ratio_bad = 0.05,
      max_n_bad = 3,
    } = options;

    return await this._get('/db-api/v1/jamming/agg', {
      lookback_hours,
      altitudes,
      altitude_summed,
      hours_summed,
      n_obs_min,
      grouped,
      full_output,
      max_ratio_bad,
      max_n_bad,
    });
  }

  /**
   * Get jamming coverage data
   */
  async getJammingCoverage(options = {}) {
    const {
      lookback_hours = 24,
      altitudes = 'FL100-FL450',
      altitude_summed = false,
      show_no_coverage = false,
      n_obs_min = 5, // Use same param name as agg for consistency in UI
      grouped = false,
    } = options;

    return await this._get('/db-api/v1/jamming/coverage', {
      lookback_hours,
      altitudes,
      altitude_summed,
      show_no_coverage,
      min_count: n_obs_min, // Map to API's min_count parameter
      grouped,
    });
  }

  /**
   * Get spoofing aggregated data as GeoJSON
   */
  async getSpoofingData(options = {}) {
    const {
      lookback_hours = 6,
      lookback_minutes = lookback_hours * 60, // Convert hours to minutes for API
    } = options;

    return await this._get('/db-api/v1/spoofing/agg/geojson', {
      lookback_minutes,
    });
  }

  /**
   * Get spoofing H3 aggregated data
   */
  async getSpoofingH3Data(options = {}) {
    const {
      lookback_minutes = 1440,
      resolution = 3,
      coordinates_source = 'interpolated',
    } = options;

    return await this._get('/db-api/v1/spoofing/h3_geojson', {
      lookback_minutes,
      resolution,
      coordinates_source,
    });
  }
}
