// Main Application
class App {
  constructor() {
    this.mapManager = null;
    this.currentSettings = {
      dataSource: 'jamming/agg',
      lookback_hours: CONFIG.JAMMING.DEFAULT_LOOKBACK_HOURS,
      altitudes: CONFIG.JAMMING.DEFAULT_ALTITUDE,
      altitude_summed: false,
      hours_summed: true,
      n_obs_min: CONFIG.JAMMING.DEFAULT_N_OBS_MIN,
      grouped: CONFIG.JAMMING.DEFAULT_GROUPED,
      full_output: false,
      max_ratio_bad: 0.05,
      max_n_bad: 3,
      show_no_coverage: false,
      // H3-specific parameters
      resolution: 3,
      coordinates_source: 'interpolated',
      max_time_diff_before_sec: 600,
      max_time_diff_after_sec: 600,
      // Spoofing-specific
      showBothSpoofingLayers: false,
      spoofingSegments: [], // Segment filter for spoofing/agg (empty = all)
      // Jamming-specific
      jammingSeverityLevels: [], // Severity filter for jamming/agg (empty = all)
    };
    this.isLoading = false;
    this.currentJsonData = null;
    this.currentActiveTab = 'map';
    this.dataViewMode = 'table'; // 'table' or 'json'
    this.tableSortColumn = null;
    this.tableSortDirection = 'asc'; // 'asc' or 'desc'
    this.refreshDebounceTimer = null;
    this.DEBOUNCE_DELAY = 2000; // 2 seconds
  }

  /**
   * Debounced refresh - waits 2 seconds after last change before refreshing
   */
  debouncedRefresh() {
    // Clear existing timer
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
    }

    // Set new timer
    this.refreshDebounceTimer = setTimeout(() => {
      this.refreshData();
    }, this.DEBOUNCE_DELAY);
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Show loading
      this.showLoading(true);

      // Initialize map
      this.mapManager = new MapManager('map', CONFIG);
      await this.mapManager.initialize();

      // Setup UI event listeners
      this.setupEventListeners();

      // Load initial data
      await this.refreshData();

      // Start auto-refresh
      this.mapManager.startAutoRefresh(
        () => this.refreshData(),
        CONFIG.JAMMING.AUTO_REFRESH_INTERVAL
      );

      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this.showError(
        'Failed to initialize application. Please refresh the page.'
      );
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Setup UI event listeners
   */
  setupEventListeners() {
    // Data source selector
    document.getElementById('data-source').addEventListener('change', (e) => {
      this.currentSettings.dataSource = e.target.value;
      this.updateControlsVisibility(e.target.value);
      this.updateLegend(e.target.value);
      this.updateStatsLabels(e.target.value);
      this.debouncedRefresh();
    });

    // Lookback hours slider
    const hoursSlider = document.getElementById('lookback-hours');
    const hoursValue = document.getElementById('hours-value');
    hoursSlider.addEventListener('input', (e) => {
      hoursValue.textContent = e.target.value;
    });
    hoursSlider.addEventListener('change', (e) => {
      this.currentSettings.lookback_hours = parseInt(e.target.value);
      this.debouncedRefresh();
    });

    // Altitude filter
    document
      .getElementById('altitude-filter')
      .addEventListener('change', (e) => {
        this.currentSettings.altitudes = e.target.value;
        this.debouncedRefresh();
      });

    // Show no coverage toggle (for coverage only)
    document
      .getElementById('toggle-show-no-coverage')
      .addEventListener('change', (e) => {
        this.currentSettings.show_no_coverage = e.target.checked;
        this.debouncedRefresh();
      });

    // Altitude summed toggle
    document
      .getElementById('toggle-altitude-summed')
      .addEventListener('change', (e) => {
        this.currentSettings.altitude_summed = e.target.checked;
        this.debouncedRefresh();
      });

    // Hours summed toggle
    document
      .getElementById('toggle-hours-summed')
      .addEventListener('change', (e) => {
        this.currentSettings.hours_summed = e.target.checked;
        this.debouncedRefresh();
      });

    // Minimum observations slider
    const nObsMinSlider = document.getElementById('n-obs-min');
    const nObsMinValue = document.getElementById('n-obs-value');
    nObsMinSlider.addEventListener('input', (e) => {
      nObsMinValue.textContent = e.target.value;
    });
    nObsMinSlider.addEventListener('change', (e) => {
      this.currentSettings.n_obs_min = parseInt(e.target.value);
      this.debouncedRefresh();
    });

    // Grouped toggle
    document
      .getElementById('toggle-grouped')
      .addEventListener('change', (e) => {
        this.currentSettings.grouped = e.target.checked;
        this.toggleGroupingControls(e.target.checked);
        this.debouncedRefresh();
      });

    // Max ratio bad slider
    const maxRatioBadSlider = document.getElementById('max-ratio-bad');
    const maxRatioBadValue = document.getElementById('max-ratio-bad-value');
    maxRatioBadSlider.addEventListener('input', (e) => {
      maxRatioBadValue.textContent = e.target.value;
    });
    maxRatioBadSlider.addEventListener('change', (e) => {
      this.currentSettings.max_ratio_bad = parseInt(e.target.value) / 100;
      this.debouncedRefresh();
    });

    // Max n bad slider
    const maxNBadSlider = document.getElementById('max-n-bad');
    const maxNBadValue = document.getElementById('max-n-bad-value');
    maxNBadSlider.addEventListener('input', (e) => {
      maxNBadValue.textContent = e.target.value;
    });
    maxNBadSlider.addEventListener('change', (e) => {
      this.currentSettings.max_n_bad = parseInt(e.target.value);
      this.debouncedRefresh();
    });

    // Full output toggle
    document
      .getElementById('toggle-full-output')
      .addEventListener('change', (e) => {
        this.currentSettings.full_output = e.target.checked;
        this.debouncedRefresh();
      });

    // H3 Resolution slider
    const h3ResolutionSlider = document.getElementById('h3-resolution');
    const h3ResolutionValue = document.getElementById('h3-resolution-value');
    h3ResolutionSlider.addEventListener('input', (e) => {
      h3ResolutionValue.textContent = e.target.value;
    });
    h3ResolutionSlider.addEventListener('change', (e) => {
      this.currentSettings.resolution = parseInt(e.target.value);
      this.debouncedRefresh();
    });

    // H3 Coordinates Source
    document
      .getElementById('h3-coords-source')
      .addEventListener('change', (e) => {
        this.currentSettings.coordinates_source = e.target.value;
        this.debouncedRefresh();
      });

    // H3 Max Time Diff Before slider
    const h3TimeDiffBeforeSlider = document.getElementById(
      'h3-time-diff-before'
    );
    const h3TimeDiffBeforeValue = document.getElementById(
      'h3-time-diff-before-value'
    );
    h3TimeDiffBeforeSlider.addEventListener('input', (e) => {
      h3TimeDiffBeforeValue.textContent = e.target.value;
    });
    h3TimeDiffBeforeSlider.addEventListener('change', (e) => {
      this.currentSettings.max_time_diff_before_sec = parseInt(e.target.value);
      this.debouncedRefresh();
    });

    // H3 Max Time Diff After slider
    const h3TimeDiffAfterSlider = document.getElementById('h3-time-diff-after');
    const h3TimeDiffAfterValue = document.getElementById(
      'h3-time-diff-after-value'
    );
    h3TimeDiffAfterSlider.addEventListener('input', (e) => {
      h3TimeDiffAfterValue.textContent = e.target.value;
    });
    h3TimeDiffAfterSlider.addEventListener('change', (e) => {
      this.currentSettings.max_time_diff_after_sec = parseInt(e.target.value);
      this.debouncedRefresh();
    });

    // Show both spoofing layers toggle
    document
      .getElementById('toggle-both-spoofing-layers')
      .addEventListener('change', (e) => {
        this.currentSettings.showBothSpoofingLayers = e.target.checked;
        this.updateLegend(this.currentSettings.dataSource); // Update legend immediately
        this.debouncedRefresh();
      });

    // Spoofing segment filter (checkboxes)
    document.querySelectorAll('.segment-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const checkedSegments = Array.from(
          document.querySelectorAll('.segment-checkbox:checked')
        ).map((cb) => cb.value);
        // If all checked or none checked, pass empty array (show all)
        const allSegments = [
          'during',
          'before-during',
          'during-after',
          'before-during-after',
        ];
        this.currentSettings.spoofingSegments =
          checkedSegments.length === 0 ||
          checkedSegments.length === allSegments.length
            ? []
            : checkedSegments;
        this.debouncedRefresh();
      });
    });

    // Jamming severity filter (checkboxes)
    document.querySelectorAll('.severity-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const checkedLevels = Array.from(
          document.querySelectorAll('.severity-checkbox:checked')
        ).map((cb) => cb.value);
        // If all checked or none checked, pass empty array (show all)
        const allLevels = ['zero', 'low', 'high'];
        this.currentSettings.jammingSeverityLevels =
          checkedLevels.length === 0 ||
          checkedLevels.length === allLevels.length
            ? []
            : checkedLevels;
        this.debouncedRefresh();
      });
    });

    // Initialize grouping controls visibility
    this.toggleGroupingControls(this.currentSettings.grouped);

    // Initialize controls visibility based on data source
    this.updateControlsVisibility(this.currentSettings.dataSource);

    // Initialize legend
    this.updateLegend(this.currentSettings.dataSource);

    // Initialize stats labels
    this.updateStatsLabels(this.currentSettings.dataSource);

    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.refreshData();
    });

    // Copy URL button
    document.getElementById('copy-url-btn').addEventListener('click', () => {
      this.copyUrlToClipboard();
    });

    // Tab switching
    document.querySelectorAll('.tab-button').forEach((button) => {
      button.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Copy JSON button
    document.getElementById('copy-json-btn').addEventListener('click', () => {
      this.copyJsonToClipboard();
    });

    // Toggle view button
    document.getElementById('toggle-view-btn').addEventListener('click', () => {
      this.toggleDataView();
    });

    // Projection toggle button
    document
      .getElementById('toggle-projection')
      .addEventListener('click', () => {
        this.toggleMapProjection();
      });
  }

  /**
   * Refresh jamming data
   */
  async refreshData() {
    if (this.isLoading) {
      console.log('Already loading data, skipping...');
      return;
    }

    try {
      this.isLoading = true;
      this.setRefreshButtonLoading(true);

      console.log('Loading data with settings:', this.currentSettings);

      const result = await this.mapManager.loadJammingData(
        this.currentSettings
      );

      // Store JSON data
      this.currentJsonData = result.data;

      // Update statistics
      this.updateStats(result.stats, result.metadata);

      // Update JSON display
      this.updateJsonDisplay(result.data);

      console.log('Data loaded successfully:', result.stats);
    } catch (error) {
      console.error('Failed to load data:', error);
      this.showError('Failed to load data. Please try again.');
    } finally {
      this.isLoading = false;
      this.setRefreshButtonLoading(false);
    }
  }

  /**
   * Update statistics panel labels based on data source
   */
  updateStatsLabels(dataSource) {
    const cellsLabel = document.getElementById('stat-cells-label');
    const aircraftLabel = document.getElementById('stat-aircraft-label');
    const aircraftItem = document
      .getElementById('stat-aircraft-label')
      .closest('.stat-item');
    const highLabel = document.getElementById('stat-high-label');
    const highItem = document.getElementById('stat-high-item');

    if (dataSource === 'jamming/agg') {
      cellsLabel.textContent = 'Total Cells:';
      aircraftLabel.textContent = 'Unique Aircraft:';
      aircraftItem.style.display = 'flex';
      highLabel.textContent = 'High Severity (≥30%):';
      highItem.style.display = 'flex';
    } else if (dataSource === 'jamming/coverage') {
      cellsLabel.textContent = 'Coverage Areas:';
      aircraftLabel.textContent = 'Unique Aircraft:';
      aircraftItem.style.display = 'none'; // Hide for coverage (not relevant)
      highLabel.textContent = 'High Severity:';
      highItem.style.display = 'none'; // Hide for coverage (not relevant)
    } else if (dataSource === 'spoofing/agg') {
      cellsLabel.textContent = 'Total Events:';
      aircraftLabel.textContent = 'Unique Aircraft:';
      aircraftItem.style.display = 'flex';
      highLabel.textContent = 'Unique Flights:';
      highItem.style.display = 'flex';
    } else if (dataSource === 'spoofing/h3') {
      cellsLabel.textContent = 'Total H3 Cells:';
      aircraftLabel.textContent = 'Total Affected:';
      aircraftItem.style.display = 'flex';
      highLabel.textContent = 'High Activity (≥10):';
      highItem.style.display = 'flex';
    }
  }

  /**
   * Update statistics panel
   */
  updateStats(stats, metadata) {
    document.getElementById('stat-cells').textContent = (
      stats.totalCells || 0
    ).toLocaleString();

    // Handle different stat types based on data source
    if (stats.totalAffected !== undefined) {
      // H3 mode: show total affected flights
      document.getElementById('stat-aircraft').textContent =
        stats.totalAffected.toLocaleString();
    } else if (stats.uniqueAircraft !== undefined) {
      // Jamming or coverage mode
      document.getElementById('stat-aircraft').textContent =
        stats.uniqueAircraft.toLocaleString();
    } else {
      document.getElementById('stat-aircraft').textContent = '0';
    }

    // Handle high severity/count cells
    if (stats.highCountCells !== undefined) {
      // H3 mode: high count cells (10+)
      document.getElementById('stat-high').textContent =
        stats.highCountCells.toLocaleString();
    } else if (stats.highSeverityCells !== undefined) {
      // Jamming/spoofing agg mode
      document.getElementById('stat-high').textContent =
        stats.highSeverityCells.toLocaleString();
    } else {
      document.getElementById('stat-high').textContent = '0';
    }

    const now = new Date();
    document.getElementById('stat-updated').textContent =
      now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short',
      });

    // Calculate and display response size
    if (this.currentJsonData) {
      const sizeBytes = new Blob([JSON.stringify(this.currentJsonData)]).size;
      const sizeFormatted = this.formatBytes(sizeBytes);
      document.getElementById('stat-size').textContent = sizeFormatted;
    }

    // Update API URL display
    if (metadata && metadata.url) {
      document.getElementById('api-url').textContent = metadata.url;
    }
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Show/hide loading overlay
   */
  showLoading(show) {
    const overlay = document.getElementById('loading');
    if (show) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  /**
   * Set refresh button loading state
   */
  setRefreshButtonLoading(loading) {
    const btn = document.getElementById('refresh-btn');
    const icon = document.getElementById('refresh-icon');

    if (loading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  /**
   * Copy API URL to clipboard
   */
  async copyUrlToClipboard() {
    const urlElement = document.getElementById('api-url');
    const copyBtn = document.getElementById('copy-url-btn');
    const url = urlElement.textContent;

    if (!url || url === '-') {
      return;
    }

    try {
      await navigator.clipboard.writeText(url);

      // Visual feedback
      copyBtn.classList.add('copied');
      copyBtn.textContent = '✓';

      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = '📋';
      }, 2000);

      console.log('URL copied to clipboard:', url);
    } catch (error) {
      console.error('Failed to copy URL:', error);

      // Fallback: select the text
      const range = document.createRange();
      range.selectNodeContents(urlElement);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Update active tab
    this.currentActiveTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach((button) => {
      if (button.dataset.tab === tabName) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });

    // Update tab contents
    document.querySelectorAll('.tab-content').forEach((content) => {
      const contentId = `tab-${content.id.replace('tab-', '')}`;
      if (content.id === `tab-${tabName}`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });

    console.log('Switched to tab:', tabName);
  }

  /**
   * Update data display (table and JSON)
   */
  updateJsonDisplay(data) {
    // Update interactive JSON viewer
    const jsonViewer = document.getElementById('json-viewer');
    if (data) {
      try {
        jsonViewer.innerHTML = '';
        this.renderJsonTree(data, jsonViewer);
      } catch (error) {
        console.error('Failed to render JSON:', error);
        jsonViewer.textContent = 'Error rendering JSON data';
      }
    } else {
      jsonViewer.textContent = 'No data loaded yet';
    }

    // Update table view
    this.updateTableDisplay(data);
  }

  /**
   * Render interactive JSON tree
   */
  renderJsonTree(data, container, key = null, level = 0) {
    const line = document.createElement('div');
    line.className = 'json-line';

    if (Array.isArray(data)) {
      this.renderArray(data, container, key, level);
    } else if (typeof data === 'object' && data !== null) {
      this.renderObject(data, container, key, level);
    } else {
      this.renderPrimitive(data, container, key, level);
    }
  }

  /**
   * Render array with collapsible functionality
   */
  renderArray(arr, container, key, level) {
    const line = document.createElement('div');
    line.className = 'json-line';

    // Toggle button
    const toggle = document.createElement('span');
    toggle.className = arr.length === 0 ? 'json-toggle empty' : 'json-toggle';
    toggle.textContent = '▼';
    line.appendChild(toggle);

    // Key if exists
    if (key !== null) {
      const keySpan = document.createElement('span');
      keySpan.className = 'json-key';
      keySpan.textContent = `"${key}"`;
      line.appendChild(keySpan);

      const separator = document.createElement('span');
      separator.className = 'json-separator';
      separator.textContent = ':';
      line.appendChild(separator);
    }

    // Opening bracket
    const bracket = document.createElement('span');
    bracket.className = 'json-bracket';
    bracket.textContent = '[';
    line.appendChild(bracket);

    // Summary (count)
    if (arr.length > 0) {
      const summary = document.createElement('span');
      summary.className = 'json-summary';
      summary.textContent = `${arr.length} items`;
      line.appendChild(summary);
    }

    container.appendChild(line);

    // Children container
    const children = document.createElement('div');
    children.className = 'json-children';

    arr.forEach((item, index) => {
      this.renderJsonTree(item, children, null, level + 1);
    });

    container.appendChild(children);

    // Closing bracket
    const closeLine = document.createElement('div');
    closeLine.className = 'json-line';
    const emptyToggle = document.createElement('span');
    emptyToggle.className = 'json-toggle empty';
    closeLine.appendChild(emptyToggle);
    const closeBracket = document.createElement('span');
    closeBracket.className = 'json-bracket';
    closeBracket.textContent = ']';
    closeLine.appendChild(closeBracket);
    container.appendChild(closeLine);

    // Add toggle functionality
    if (arr.length > 0) {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('collapsed');
        children.classList.toggle('collapsed');
      });
    }
  }

  /**
   * Render object with collapsible functionality
   */
  renderObject(obj, container, key, level) {
    const keys = Object.keys(obj);
    const line = document.createElement('div');
    line.className = 'json-line';

    // Toggle button
    const toggle = document.createElement('span');
    toggle.className = keys.length === 0 ? 'json-toggle empty' : 'json-toggle';
    toggle.textContent = '▼';
    line.appendChild(toggle);

    // Key if exists
    if (key !== null) {
      const keySpan = document.createElement('span');
      keySpan.className = 'json-key';
      keySpan.textContent = `"${key}"`;
      line.appendChild(keySpan);

      const separator = document.createElement('span');
      separator.className = 'json-separator';
      separator.textContent = ':';
      line.appendChild(separator);
    }

    // Opening brace
    const brace = document.createElement('span');
    brace.className = 'json-bracket';
    brace.textContent = '{';
    line.appendChild(brace);

    // Summary (key count)
    if (keys.length > 0) {
      const summary = document.createElement('span');
      summary.className = 'json-summary';
      summary.textContent = `${keys.length} properties`;
      line.appendChild(summary);
    }

    container.appendChild(line);

    // Children container
    const children = document.createElement('div');
    children.className = 'json-children';

    keys.forEach((objKey) => {
      this.renderJsonTree(obj[objKey], children, objKey, level + 1);
    });

    container.appendChild(children);

    // Closing brace
    const closeLine = document.createElement('div');
    closeLine.className = 'json-line';
    const emptyToggle = document.createElement('span');
    emptyToggle.className = 'json-toggle empty';
    closeLine.appendChild(emptyToggle);
    const closeBrace = document.createElement('span');
    closeBrace.className = 'json-bracket';
    closeBrace.textContent = '}';
    closeLine.appendChild(closeBrace);
    container.appendChild(closeLine);

    // Add toggle functionality
    if (keys.length > 0) {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('collapsed');
        children.classList.toggle('collapsed');
      });
    }
  }

  /**
   * Render primitive value
   */
  renderPrimitive(value, container, key, level) {
    const line = document.createElement('div');
    line.className = 'json-line';

    // Empty toggle space
    const emptyToggle = document.createElement('span');
    emptyToggle.className = 'json-toggle empty';
    line.appendChild(emptyToggle);

    // Key if exists
    if (key !== null) {
      const keySpan = document.createElement('span');
      keySpan.className = 'json-key';
      keySpan.textContent = `"${key}"`;
      line.appendChild(keySpan);

      const separator = document.createElement('span');
      separator.className = 'json-separator';
      separator.textContent = ':';
      line.appendChild(separator);
    }

    // Value
    const valueSpan = document.createElement('span');
    valueSpan.className = 'json-value';

    if (typeof value === 'string') {
      valueSpan.classList.add('string');
      valueSpan.textContent = `"${value}"`;
    } else if (typeof value === 'number') {
      valueSpan.classList.add('number');
      valueSpan.textContent = value;
    } else if (typeof value === 'boolean') {
      valueSpan.classList.add('boolean');
      valueSpan.textContent = value;
    } else if (value === null) {
      valueSpan.classList.add('null');
      valueSpan.textContent = 'null';
    } else {
      valueSpan.textContent = String(value);
    }

    line.appendChild(valueSpan);
    container.appendChild(line);
  }

  /**
   * Build and update table from GeoJSON data
   */
  updateTableDisplay(data) {
    const table = document.getElementById('data-table');
    const countDisplay = document.getElementById('data-count');

    if (!data || !data.features || data.features.length === 0) {
      table.innerHTML = `
        <thead><tr><th>No data available</th></tr></thead>
        <tbody><tr><td>Load data using the controls to see results</td></tr></tbody>
      `;
      countDisplay.textContent = '0 records';
      return;
    }

    let features = [...data.features]; // Clone array
    countDisplay.textContent = `${features.length} records`;

    // Extract all unique property keys from features
    const propertyKeys = new Set();
    features.forEach((feature) => {
      if (feature.properties) {
        Object.keys(feature.properties).forEach((key) => propertyKeys.add(key));
      }
    });

    // Separate h3_index/h3_indices and other index fields from regular properties
    const indexFields = [];
    const regularProperties = [];

    Array.from(propertyKeys)
      .sort()
      .forEach((key) => {
        // Check for index fields (both singular and plural)
        if (
          key === 'h3_index' ||
          key === 'h3_indices' ||
          key.endsWith('_index') ||
          key.endsWith('_indices')
        ) {
          indexFields.push(key);
        } else {
          regularProperties.push(key);
        }
      });

    // Build column headers: id, regular properties, h3_index/indices, type, geometry
    const columns = [
      'id',
      ...regularProperties,
      ...indexFields,
      'type',
      'geometry',
    ];

    // Sort features if a column is selected
    if (this.tableSortColumn) {
      features = this.sortFeatures(
        features,
        this.tableSortColumn,
        this.tableSortDirection
      );
    }

    // Build table HTML
    let tableHtml = '<thead><tr>';
    columns.forEach((col) => {
      const sortClass =
        this.tableSortColumn === col
          ? `sortable sort-${this.tableSortDirection}`
          : 'sortable';
      tableHtml += `<th class="${sortClass}" data-column="${col}">${col}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    // Build rows
    features.forEach((feature) => {
      tableHtml += '<tr>';

      columns.forEach((col) => {
        let cellValue = '';
        let cellClass = '';

        if (col === 'id') {
          cellValue = feature.id || '-';
        } else if (col === 'type') {
          cellValue = feature.geometry?.type || '-';
        } else if (col === 'geometry') {
          cellValue = feature.geometry ? '✓' : '-';
          cellClass = 'geometry-cell';
        } else {
          // Property value
          const value = feature.properties?.[col];
          if (value !== undefined && value !== null) {
            // Special handling for ratio_bad
            if (col === 'ratio_bad') {
              cellValue = (value * 100).toFixed(1) + '%';
              cellClass = 'ratio-cell ';
              if (value < 0.05) cellClass += 'ratio-minimal';
              else if (value < 0.15) cellClass += 'ratio-low';
              else if (value < 0.3) cellClass += 'ratio-moderate';
              else cellClass += 'ratio-high';
            } else if (col === 'coverage') {
              // Special handling for coverage field
              const hasCoverage = value !== 'none';
              cellValue = hasCoverage ? '✓ Has Coverage' : '✗ No Coverage';
              cellClass = hasCoverage ? 'coverage-yes' : 'coverage-no';
            } else if (typeof value === 'number') {
              cellValue = value.toLocaleString();
              cellClass = 'number-cell';
            } else if (Array.isArray(value)) {
              // Handle arrays (like h3_indices)
              cellValue = `[${value.length} items]`;
              cellClass = 'array-cell';
            } else {
              cellValue = String(value);
            }
          } else {
            cellValue = '-';
          }
        }

        tableHtml += `<td class="${cellClass}">${cellValue}</td>`;
      });

      tableHtml += '</tr>';
    });

    tableHtml += '</tbody>';
    table.innerHTML = tableHtml;

    // Add click listeners to headers for sorting
    table.querySelectorAll('th[data-column]').forEach((th) => {
      th.addEventListener('click', () => {
        const column = th.dataset.column;
        this.sortTable(column);
      });
    });
  }

  /**
   * Sort table by column
   */
  sortTable(column) {
    if (this.tableSortColumn === column) {
      // Toggle direction if same column
      this.tableSortDirection =
        this.tableSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New column, default to ascending
      this.tableSortColumn = column;
      this.tableSortDirection = 'asc';
    }

    // Re-render table with sorted data
    this.updateTableDisplay(this.currentJsonData);
  }

  /**
   * Sort features array by column
   */
  sortFeatures(features, column, direction) {
    return features.sort((a, b) => {
      let aVal, bVal;

      // Get values based on column type
      if (column === 'id') {
        aVal = a.id;
        bVal = b.id;
      } else if (column === 'type') {
        aVal = a.type;
        bVal = b.type;
      } else if (column === 'geometry') {
        aVal = a.geometry ? 1 : 0;
        bVal = b.geometry ? 1 : 0;
      } else {
        // Property value
        aVal = a.properties?.[column];
        bVal = b.properties?.[column];
      }

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return direction === 'asc' ? 1 : -1;
      if (bVal == null) return direction === 'asc' ? -1 : 1;

      // Compare based on type
      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        // String comparison
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        comparison = aStr.localeCompare(bStr);
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Toggle between table and JSON view
   */
  toggleDataView() {
    const tableView = document.getElementById('table-view');
    const jsonView = document.getElementById('json-viewer');
    const toggleBtn = document.getElementById('toggle-view-btn');

    if (this.dataViewMode === 'table') {
      // Switch to JSON view
      this.dataViewMode = 'json';
      tableView.style.display = 'none';
      jsonView.classList.remove('hidden');
      toggleBtn.textContent = '📊 Show Table';
    } else {
      // Switch to table view
      this.dataViewMode = 'table';
      tableView.style.display = 'block';
      jsonView.classList.add('hidden');
      toggleBtn.textContent = '📋 Show Raw JSON';
    }
  }

  /**
   * Copy JSON data to clipboard
   */
  async copyJsonToClipboard() {
    const copyBtn = document.getElementById('copy-json-btn');

    if (!this.currentJsonData) {
      return;
    }

    try {
      const jsonString = JSON.stringify(this.currentJsonData, null, 2);
      await navigator.clipboard.writeText(jsonString);

      // Visual feedback
      copyBtn.classList.add('copied');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied!';

      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = originalText;
      }, 2000);

      console.log('JSON copied to clipboard');
    } catch (error) {
      console.error('Failed to copy JSON:', error);
      alert('Failed to copy JSON to clipboard');
    }
  }

  /**
   * Toggle map projection (globe/flat)
   */
  toggleMapProjection() {
    const newProjection = this.mapManager.toggleProjection();
    const btn = document.getElementById('toggle-projection');

    if (newProjection === 'globe') {
      btn.textContent = '🌍 Globe';
    } else {
      btn.textContent = '🗺️ Flat';
    }

    console.log('Map projection changed to:', newProjection);
  }

  /**
   * Toggle visibility of grouping-specific controls
   */
  toggleGroupingControls(show) {
    const maxRatioBadGroup = document.getElementById('group-max-ratio-bad');
    const maxNBadGroup = document.getElementById('group-max-n-bad');

    // Only show these for aggregated data when grouped is enabled
    const isCoverage = this.currentSettings.dataSource === 'jamming/coverage';

    if (show && !isCoverage) {
      maxRatioBadGroup.style.display = 'block';
      maxNBadGroup.style.display = 'block';
    } else {
      maxRatioBadGroup.style.display = 'none';
      maxNBadGroup.style.display = 'none';
    }
  }

  /**
   * Update legend based on data source
   */
  updateLegend(dataSource) {
    const legend = document.getElementById('map-legend');
    const isCoverage = dataSource === 'jamming/coverage';
    const isSpoofing = dataSource.startsWith('spoofing/');

    if (isSpoofing) {
      const isH3 = dataSource === 'spoofing/h3';
      const showBoth = this.currentSettings.showBothSpoofingLayers;

      if (showBoth) {
        // Both layers legend (combined)
        legend.innerHTML = `
          <h4>Spoofing (Both Layers)</h4>
          <div style="margin-top: 0.5rem; font-weight: 600;">Flight Events:</div>
          <div class="legend-item">
            <span class="legend-color" style="background: #f59e0b; width: 30px; height: 3px; border-radius: 0;"></span>
            <span>Flight Path</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #dc2626; border: 2px solid #fff; border-radius: 50%;"></span>
            <span>Event Location</span>
          </div>
          <div style="margin-top: 0.5rem; font-weight: 600;">H3 Grid:</div>
          <div class="legend-item">
            <span class="legend-color" style="background: #fef3c7"></span>
            <span>1-5 Flights</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #fbbf24"></span>
            <span>5-10 Flights</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #f59e0b"></span>
            <span>10-20 Flights</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #d97706"></span>
            <span>20-50 Flights</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #dc2626"></span>
            <span>50+ Flights</span>
          </div>
        `;
      } else if (isH3) {
        // H3 Grid legend
        legend.innerHTML = `
          <h4>Spoofing H3 Grid</h4>
          <div class="legend-item">
            <span class="legend-color" style="background: #fef3c7"></span>
            <span>1-5 Flights</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #fbbf24"></span>
            <span>5-10 Flights</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #f59e0b"></span>
            <span>10-20 Flights</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #d97706"></span>
            <span>20-50 Flights</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #dc2626"></span>
            <span>50+ Flights</span>
          </div>
        `;
      } else {
        // Spoofing agg legend
        legend.innerHTML = `
          <h4>Spoofing Events</h4>
          <div class="legend-item">
            <span class="legend-color" style="background: #f59e0b; width: 30px; height: 3px; border-radius: 0;"></span>
            <span>Flight Path</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #dc2626; border: 2px solid #fff; border-radius: 50%;"></span>
            <span>Event Location</span>
          </div>
        `;
      }
    } else if (isCoverage) {
      // Coverage legend
      legend.innerHTML = `
        <h4>Coverage Areas</h4>
        <div class="legend-item">
          <span class="legend-color" style="background: #10b981"></span>
          <span>Has Coverage</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #dc2626"></span>
          <span>No Coverage</span>
        </div>
      `;
    } else {
      // Jamming aggregated legend (3 levels)
      legend.innerHTML = `
        <h4>Jamming Severity</h4>
        <div class="legend-item">
          <span class="legend-color" style="background: #E5E7EB"></span>
          <span>Zero (0%-1%)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #FCD34D"></span>
          <span>Low (1%-10%)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #DC2626"></span>
          <span>High (10%-100%)</span>
        </div>
      `;
    }
  }

  /**
   * Update control visibility based on data source
   */
  updateControlsVisibility(dataSource) {
    const isCoverage = dataSource === 'jamming/coverage';
    const isSpoofing = dataSource.startsWith('spoofing/');

    // Get control elements
    const nObsMinGroup = document
      .querySelector('#n-obs-min')
      .closest('.control-group');
    const nObsMinLabel = nObsMinGroup.querySelector('label');
    const nObsMinSmall = nObsMinGroup.querySelector('small');

    const altitudeGroup = document
      .getElementById('altitude-filter')
      .closest('.control-group');
    const showNoCoverageGroup = document.getElementById(
      'coverage-show-no-coverage'
    );
    const groupingSection = document.querySelector(
      '.control-group .section-label'
    ).parentElement;
    const groupedToggleGroup = document
      .getElementById('toggle-grouped')
      .closest('.control-group');
    const altitudeSummedGroup = document
      .getElementById('toggle-altitude-summed')
      .closest('.control-group');
    const hoursSummedGroup = document
      .getElementById('toggle-hours-summed')
      .closest('.control-group');
    const fullOutputGroup = document
      .getElementById('toggle-full-output')
      .closest('.control-group');
    const outputSection = fullOutputGroup.previousElementSibling; // The "Output Options" section

    // Date range placeholder controls
    const jammingDateRange = document.getElementById('jamming-date-range');
    const spoofingDateRange = document.getElementById('spoofing-date-range');

    // Spoofing segment filter
    const spoofingSegmentFilter = document.getElementById(
      'spoofing-segment-filter'
    );

    // Jamming severity filter
    const jammingSeverityFilter = document.getElementById(
      'jamming-severity-filter'
    );

    // H3 control groups
    const h3Options = document.getElementById('h3-options');
    const h3ResolutionGroup = document.getElementById('h3-resolution-group');
    const h3CoordsSourceGroup = document.getElementById(
      'h3-coords-source-group'
    );
    const h3TimeDiffBeforeGroup = document.getElementById(
      'h3-time-diff-before-group'
    );
    const h3TimeDiffAfterGroup = document.getElementById(
      'h3-time-diff-after-group'
    );

    const isH3 = dataSource === 'spoofing/h3';

    // Spoofing "both layers" control
    const spoofingBothLayersGroup = document.getElementById(
      'spoofing-both-layers'
    );

    if (isSpoofing) {
      // For spoofing: hide all jamming controls
      nObsMinGroup.style.display = 'none';
      altitudeGroup.style.display = 'none';
      showNoCoverageGroup.style.display = 'none';
      groupingSection.style.display = 'none';
      groupedToggleGroup.style.display = 'none';
      altitudeSummedGroup.style.display = 'none';
      hoursSummedGroup.style.display = 'none';
      fullOutputGroup.style.display = 'none';
      outputSection.style.display = 'none';
      document.getElementById('group-max-ratio-bad').style.display = 'none';
      document.getElementById('group-max-n-bad').style.display = 'none';
      jammingSeverityFilter.style.display = 'none';

      // Show "both layers" option for spoofing
      spoofingBothLayersGroup.style.display = 'block';

      // Show/hide spoofing-specific controls based on type
      jammingDateRange.style.display = 'none';

      if (isH3) {
        // H3 mode: hide agg date range and segment filter, show H3 controls
        spoofingDateRange.style.display = 'none';
        spoofingSegmentFilter.style.display = 'none';
        h3Options.style.display = 'block';
        h3ResolutionGroup.style.display = 'block';
        h3CoordsSourceGroup.style.display = 'block';
        h3TimeDiffBeforeGroup.style.display = 'block';
        h3TimeDiffAfterGroup.style.display = 'block';
      } else {
        // Agg mode: show agg date range and segment filter, hide H3 controls
        spoofingDateRange.style.display = 'block';
        spoofingSegmentFilter.style.display = 'block';
        h3Options.style.display = 'none';
        h3ResolutionGroup.style.display = 'none';
        h3CoordsSourceGroup.style.display = 'none';
        h3TimeDiffBeforeGroup.style.display = 'none';
        h3TimeDiffAfterGroup.style.display = 'none';
      }
    } else if (isCoverage) {
      // For coverage: change "Min Observations" to "Min Count"
      nObsMinLabel.innerHTML =
        'Min Count: <span id="n-obs-value">' +
        document.getElementById('n-obs-value').textContent +
        '</span>';
      nObsMinSmall.textContent = 'Minimum total observations per cell';

      // Show coverage-specific controls
      showNoCoverageGroup.style.display = 'block';

      // Hide aggregated-data-only controls
      hoursSummedGroup.style.display = 'none';
      fullOutputGroup.style.display = 'none';
      outputSection.style.display = 'none';

      // Hide grouping-specific agg controls
      document.getElementById('group-max-ratio-bad').style.display = 'none';
      document.getElementById('group-max-n-bad').style.display = 'none';

      // Hide date range placeholders (coverage doesn't support date ranges)
      jammingDateRange.style.display = 'none';
      spoofingDateRange.style.display = 'none';

      // Hide spoofing-specific controls
      spoofingBothLayersGroup.style.display = 'none';
      spoofingSegmentFilter.style.display = 'none';

      // Hide jamming severity filter (not for coverage)
      jammingSeverityFilter.style.display = 'none';

      // Hide H3 controls
      h3Options.style.display = 'none';
      h3ResolutionGroup.style.display = 'none';
      h3CoordsSourceGroup.style.display = 'none';
      h3TimeDiffBeforeGroup.style.display = 'none';
      h3TimeDiffAfterGroup.style.display = 'none';
    } else {
      // For aggregated jamming: use "Min Observations"
      nObsMinLabel.innerHTML =
        'Min Observations: <span id="n-obs-value">' +
        document.getElementById('n-obs-value').textContent +
        '</span>';
      nObsMinSmall.textContent = 'Minimum unique aircraft per cell';

      // Show all controls
      nObsMinGroup.style.display = 'block';
      altitudeGroup.style.display = 'block';
      groupingSection.style.display = 'block';
      groupedToggleGroup.style.display = 'block';
      altitudeSummedGroup.style.display = 'block';
      hoursSummedGroup.style.display = 'block';
      fullOutputGroup.style.display = 'block';
      outputSection.style.display = 'block';

      // Hide coverage-specific controls
      showNoCoverageGroup.style.display = 'none';

      // Show jamming date range placeholder
      jammingDateRange.style.display = 'block';
      spoofingDateRange.style.display = 'none';

      // Show jamming severity filter (for agg only)
      jammingSeverityFilter.style.display = 'block';

      // Hide spoofing-specific controls
      spoofingBothLayersGroup.style.display = 'none';
      spoofingSegmentFilter.style.display = 'none';

      // Hide H3 controls
      h3Options.style.display = 'none';
      h3ResolutionGroup.style.display = 'none';
      h3CoordsSourceGroup.style.display = 'none';
      h3TimeDiffBeforeGroup.style.display = 'none';
      h3TimeDiffAfterGroup.style.display = 'none';

      // Update grouping controls based on current grouped state
      this.toggleGroupingControls(this.currentSettings.grouped);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    // For now, just alert. Could be improved with a toast notification
    alert(message);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
