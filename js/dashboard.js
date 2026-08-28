/**
 * AI Data Analyst - Dashboard & Visualization Engine
 * Handles Chart.js instances, SVG Animated Quality Gauge,
 * Paginated Column Profiler, Categorized Insights Feed, and PDF Report Export.
 */

const Dashboard = {
  charts: {
    distribution: null,
    trend: null,
    categorical: null,
    correlation: null,
    customChart: null
  },
  
  columnTableState: {
    searchQuery: '',
    currentPage: 1,
    pageSize: 8,
    typeFilter: 'all'
  },

  insightFilter: 'all',

  advVizState: {
    activeTab: 'scatter',
    scatterX: null,
    scatterY: null,
    scatterGroup: null,
    boxMetric: null,
    boxGroup: null,
    geoCol: null,
    geoMetric: null,
    geoAgg: 'sum'
  },

  currentSection: 'all',
  lastRenderedDatasetId: null,

  /**
   * Switch active dashboard section for instant 1-click no-scroll browsing
   */
  switchSection(sectionId) {
    this.currentSection = sectionId;
    const sections = ['overview', 'charts', 'advanced', 'schema'];
    const navButtons = ['overview', 'charts', 'advanced', 'schema', 'all'];

    // Update Nav Buttons appearance instantly
    navButtons.forEach(navKey => {
      const btn = document.getElementById(`dash-nav-${navKey}`);
      if (btn) {
        if (navKey === sectionId) {
          btn.className = 'dash-sec-btn active px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow-sm flex items-center gap-1.5 whitespace-nowrap';
        } else {
          btn.className = 'dash-sec-btn px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 whitespace-nowrap';
        }
      }
    });

    // Update Section Visibility instantly
    sections.forEach(secKey => {
      const secEl = document.getElementById(`dash-sec-${secKey}`);
      if (secEl) {
        if (sectionId === 'all' || sectionId === secKey) {
          secEl.classList.remove('hidden');
        } else {
          secEl.classList.add('hidden');
        }
      }
    });

    const dataset = (window.App && window.App.state && window.App.state.currentAnalysis) ? window.App.state.currentAnalysis : (this.currentDataset || null);

    // Re-render and resize charts after DOM container unhides to ensure non-zero dimensions
    setTimeout(() => {
      if (sectionId === 'charts' || sectionId === 'all') {
        if (dataset && dataset.profile) {
          this.renderCharts(dataset.profile);
        }
      }
      if (sectionId === 'overview' || sectionId === 'all') {
        if (this.charts.trend && typeof this.charts.trend.resize === 'function') {
          this.charts.trend.resize();
        }
      }
      if (sectionId === 'advanced' || sectionId === 'all') {
        this.switchAdvTab(this.advVizState.activeTab || 'scatter');
      }
      Object.values(this.charts).forEach(c => {
        if (c && typeof c.resize === 'function') {
          c.resize();
          c.update();
        }
      });
    }, 40);
  },

  /**
   * Main render method for the entire dashboard
   */
  render(dataset) {
    if (!dataset || !dataset.profile) {
      console.warn('No dataset provided to Dashboard.render()');
      return;
    }

    this.currentDataset = dataset;
    if (window.App && window.App.state) {
      window.App.state.currentAnalysis = dataset;
    }

    this.lastRenderedDatasetId = dataset.id;

    const profile = dataset.profile;

    // Update Header Metadata
    this.renderHeader(dataset);

    // Render KPIs (Bug 7 fix)
    this.renderKPIs(profile);

    // Render SVG Circular Quality Gauge (Bug 7 fix)
    this.renderQualityGauge(profile);

    // Render Primary Visualizations (Bug 8 fix)
    this.renderCharts(profile);

    // Render Advanced Visualizations Studio (Scatter, Box Plot, Choropleth)
    this.renderAdvancedVisualizations(dataset);

    // Render Paginated Column Profile Table
    this.renderColumnTable(profile);

    // Render Filterable Insights Feed
    this.renderInsights(profile);

    // Render Raw Data Preview Table
    this.renderDataPreview(profile);

    // Apply active section view
    this.switchSection(this.currentSection || 'all');
  },

  renderHeader(dataset) {
    const filenameEl = document.getElementById('dashboard-filename');
    const headerDatasetNameEl = document.getElementById('header-dataset-name');
    const metaEl = document.getElementById('dashboard-meta');
    const badgeEl = document.getElementById('dashboard-badge');

    const displayName = dataset.filename || 'global_tech_sales_2025.csv';
    if (filenameEl) filenameEl.textContent = displayName;
    if (headerDatasetNameEl) headerDatasetNameEl.textContent = displayName;
    
    const rows = dataset.profile.total_rows || dataset.profile.shape?.rows || 0;
    const cols = dataset.profile.columns?.length || dataset.profile.total_columns || 0;
    const size = dataset.file_size || `${((rows * cols * 8) / 1024).toFixed(1)} KB`;

    if (metaEl) {
      metaEl.innerHTML = `
        <span><i class="fa-solid fa-table-cells mr-1.5 text-emerald-500"></i>${rows.toLocaleString()} Records</span>
        <span class="mx-2 text-slate-400">•</span>
        <span><i class="fa-solid fa-columns mr-1.5 text-teal-500"></i>${cols} Features</span>
        <span class="mx-2 text-slate-400">•</span>
        <span><i class="fa-solid fa-hard-drive mr-1.5 text-purple-500"></i>${size}</span>
      `;
    }

    if (badgeEl) {
      badgeEl.textContent = dataset.id === 'demo' ? 'Demo Mode' : 'Live Ingestion';
      badgeEl.className = dataset.id === 'demo'
        ? 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
        : 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    }
  },

  /**
   * Fix Bug 7: Fallback properties for KPIs & stats
   */
  renderKPIs(profile) {
    const totalRows = profile.total_rows || profile.shape?.rows || profile.rows || 0;
    const columns = profile.columns || [];
    const numCols = columns.filter(c => ApiService.isNum(c));
    const catCols = columns.filter(c => ApiService.isCat(c));

    const totalCells = (totalRows * columns.length) || 1;
    const missingCells = profile.missing_cells ?? profile.quality?.total_null_cells ?? 0;
    const missingPct = ((missingCells / totalCells) * 100);
    const completeness = Math.max(0, 100 - missingPct);

    // Update KPI Card 1: Records
    const kpi1Val = document.getElementById('kpi-records-value');
    const kpi1Sub = document.getElementById('kpi-records-sub');
    if (kpi1Val) kpi1Val.textContent = totalRows.toLocaleString();
    if (kpi1Sub) kpi1Sub.textContent = `${columns.length} Total Columns`;

    // Update KPI Card 2: Features Distribution
    const kpi2Val = document.getElementById('kpi-features-value');
    const kpiNumBadge = document.getElementById('kpi-num-badge');
    const kpiCatBadge = document.getElementById('kpi-cat-badge');
    if (kpi2Val) kpi2Val.textContent = `${columns.length} Columns`;
    if (kpiNumBadge) kpiNumBadge.textContent = `${numCols.length} Numeric`;
    if (kpiCatBadge) kpiCatBadge.textContent = `${catCols.length} Categorical`;

    // Update KPI Card 4: Missing Cells / Completeness
    const kpiCompVal = document.getElementById('kpi-completeness-value');
    const kpiMissingBar = document.getElementById('kpi-missing-bar');
    if (kpiCompVal) kpiCompVal.textContent = `${missingPct.toFixed(2)}%`;
    if (kpiMissingBar) kpiMissingBar.style.width = `${Math.max(2, Math.min(100, missingPct * 10))}%`;
  },

  /**
   * Fix Bug 7: Animated SVG Quality Gauge with exact circumference offsets and color transitions
   */
  renderQualityGauge(profile) {
    const rawScore =
      profile.quality?.quality_score ??
      profile.quality?.score ??
      profile.quality_score ??
      profile.quality?.completeness ??
      95.0;

    const score = Math.min(100, Math.max(0, parseFloat(rawScore)));

    const scoreTextEl = document.getElementById('gauge-score-text');
    const scoreRatingEl = document.getElementById('gauge-rating-badge');
    const progressCircle = document.getElementById('gauge-progress-circle');

    if (scoreTextEl) scoreTextEl.textContent = `${score.toFixed(1)}%`;

    // SVG Math: radius = 54 -> circumference = 2 * PI * 54 = 339.292
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    let strokeColor = '#10b981'; // Emerald >= 80%
    let ratingText = 'Optimal Health';
    let ratingClass = 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';

    if (score < 60) {
      strokeColor = '#ef4444'; // Rose < 60%
      ratingText = 'Needs Cleansing';
      ratingClass = 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
    } else if (score < 80) {
      strokeColor = '#f59e0b'; // Amber < 80%
      ratingText = 'Moderate Health';
      ratingClass = 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
    }

    if (progressCircle) {
      progressCircle.style.strokeDasharray = `${circumference}`;
      progressCircle.style.strokeDashoffset = `${circumference}`; // start at 0
      progressCircle.style.stroke = strokeColor;
      
      // Animate progress smoothly
      setTimeout(() => {
        progressCircle.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
        progressCircle.style.strokeDashoffset = `${offset}`;
      }, 50);
    }

    if (scoreRatingEl) {
      scoreRatingEl.textContent = ratingText;
      scoreRatingEl.className = `px-3 py-1 rounded-full text-xs font-semibold inline-block ${ratingClass}`;
    }

    // Populate quality breakdown stats
    const qCompleteness = document.getElementById('gauge-completeness');
    const qUniqueness = document.getElementById('gauge-uniqueness');
    const qValidity = document.getElementById('gauge-validity');

    if (qCompleteness) qCompleteness.textContent = `${(profile.quality?.completeness ?? score).toFixed(1)}%`;
    if (qUniqueness) qUniqueness.textContent = `${(profile.quality?.uniqueness ?? 100).toFixed(1)}%`;
    if (qValidity) qValidity.textContent = `${(profile.quality?.validity ?? 98.4).toFixed(1)}%`;
  },

  /**
   * Render all primary charts with dark/light mode awareness
   */
  renderCharts(profile) {
    const isDark = document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const columns = profile.columns || [];
    const numCols = columns.filter(c => ApiService.isNum(c));
    const catCols = columns.filter(c => ApiService.isCat(c));

    // 1. Numeric Histogram Distribution Chart
    this.renderDistributionChart(numCols, gridColor, textColor);

    // 2. Trend / Time-Series Line Area Chart
    this.renderTrendChart(columns, numCols, gridColor, textColor);

    // 3. Categorical Breakdown Horizontal Bar Chart
    this.renderCategoricalChart(catCols, gridColor, textColor);

    // 4. Correlation Heatmap Grid (Fix Bug 8)
    this.renderCorrelationMatrix(columns, numCols, profile.correlations || []);
  },

  renderDistributionChart(numCols, gridColor, textColor) {
    const ctx = document.getElementById('chart-distribution');
    if (!ctx) return;

    if (this.charts.distribution) {
      this.charts.distribution.destroy();
    }

    const col = numCols[0];
    if (!col || !col.histogram) {
      // Fallback if no precomputed histogram
      const labels = ['Bin 1', 'Bin 2', 'Bin 3', 'Bin 4', 'Bin 5', 'Bin 6'];
      const data = [12, 28, 45, 30, 18, 9];
      this.charts.distribution = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Frequency',
            data,
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: this.getBaseChartOptions('Frequency Distribution', gridColor, textColor)
      });
      return;
    }

    const titleEl = document.getElementById('chart-distribution-title');
    if (titleEl) titleEl.textContent = `Distribution: ${col.name}`;

    this.charts.distribution = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: col.histogram.labels,
        datasets: [{
          label: col.name,
          data: col.histogram.values,
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          hoverBackgroundColor: 'rgba(16, 185, 129, 0.95)',
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: this.getBaseChartOptions(`Frequency: ${col.name}`, gridColor, textColor)
    });
  },

  renderTrendChart(columns, numCols, gridColor, textColor) {
    const ctx = document.getElementById('chart-trend');
    if (!ctx) return;

    if (this.charts.trend) {
      this.charts.trend.destroy();
    }

    const titleEl = document.getElementById('chart-trend-title');
    const dataset = this.currentDataset || (window.App && window.App.state && window.App.state.currentAnalysis);
    const records = dataset?.records || dataset?.data || dataset?.sample_rows || [];
    const catCols = columns.filter(c => ApiService.isCat(c));
    const primaryNum = numCols[0] || { name: 'Value' };
    const dateCol = columns.find(c => ApiService.isDate(c)) || columns.find(c => {
      const n = c.name.toLowerCase();
      return n.includes('year') || n.includes('date') || n.includes('month') || n.includes('time') || n.includes('period') || n.includes('day');
    });

    let labels = [];
    let values = [];
    let seriesLabel = 'Value Trend';
    let chartTitle = 'Trend Progression & Trajectory';

    // 1. If a Date/Time/Year column exists
    if (dateCol && records.length > 0) {
      chartTitle = `Timeline Trajectory (${primaryNum.name} by ${dateCol.name})`;
      seriesLabel = `Avg ${primaryNum.name}`;

      const groups = {};
      records.forEach(r => {
        const k = r[dateCol.name];
        const v = typeof r[primaryNum.name] === 'number' ? r[primaryNum.name] : parseFloat(r[primaryNum.name]);
        if (k !== undefined && k !== null && k !== '' && !isNaN(v)) {
          if (!groups[k]) groups[k] = { sum: 0, count: 0 };
          groups[k].sum += v;
          groups[k].count += 1;
        }
      });

      const sortedKeys = Object.keys(groups).sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b));
      }).slice(0, 16);

      if (sortedKeys.length >= 2) {
        labels = sortedKeys;
        values = sortedKeys.map(k => parseFloat((groups[k].sum / groups[k].count).toFixed(2)));
      }
    }

    // 2. If no date column, but Categorical + Numerical records exist
    if (labels.length === 0 && catCols.length > 0 && records.length > 0) {
      const catCol = catCols[0];
      chartTitle = `Distribution Trajectory (${primaryNum.name} by ${catCol.name})`;
      seriesLabel = `Avg ${primaryNum.name}`;

      const groups = {};
      records.forEach(r => {
        const k = r[catCol.name];
        const v = typeof r[primaryNum.name] === 'number' ? r[primaryNum.name] : parseFloat(r[primaryNum.name]);
        if (k !== undefined && k !== null && k !== '' && !isNaN(v)) {
          if (!groups[k]) groups[k] = { sum: 0, count: 0 };
          groups[k].sum += v;
          groups[k].count += 1;
        }
      });

      const sortedEntries = Object.entries(groups).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
      if (sortedEntries.length >= 2) {
        labels = sortedEntries.map(e => String(e[0]));
        values = sortedEntries.map(e => parseFloat((e[1].sum / e[1].count).toFixed(2)));
      }
    }

    // 3. If records exist, build rolling quantile decile segments
    if (labels.length === 0 && records.length >= 10) {
      chartTitle = `Sequential Trajectory: ${primaryNum.name}`;
      seriesLabel = `Mean ${primaryNum.name}`;

      const validNums = records.map(r => {
        const v = typeof r[primaryNum.name] === 'number' ? r[primaryNum.name] : parseFloat(r[primaryNum.name]);
        return isNaN(v) ? null : v;
      }).filter(v => v !== null);

      if (validNums.length >= 10) {
        const numSegments = 10;
        const chunkSize = Math.ceil(validNums.length / numSegments);
        for (let i = 0; i < numSegments; i++) {
          const chunk = validNums.slice(i * chunkSize, (i + 1) * chunkSize);
          if (chunk.length > 0) {
            const startIdx = i * chunkSize + 1;
            const endIdx = Math.min((i + 1) * chunkSize, validNums.length);
            labels.push(`Batch ${startIdx}–${endIdx}`);
            const avg = chunk.reduce((a, b) => a + b, 0) / chunk.length;
            values.push(parseFloat(avg.toFixed(2)));
          }
        }
      }
    }

    // 4. Fallback to histogram distribution of the primary numeric column
    if (labels.length === 0 && primaryNum.histogram && primaryNum.histogram.labels) {
      chartTitle = `Density Curve: ${primaryNum.name}`;
      seriesLabel = `Frequency`;
      labels = primaryNum.histogram.labels;
      values = primaryNum.histogram.values;
    }

    // 5. Ultimate safety fallback using column moments
    if (labels.length === 0) {
      chartTitle = `Metric Bounds: ${primaryNum.name}`;
      seriesLabel = primaryNum.name;
      const min = primaryNum.min || 0;
      const mean = primaryNum.mean || 50;
      const max = primaryNum.max || 100;
      labels = ['Min', 'Q1', 'Median', 'Mean', 'Q3', 'Max'];
      values = [min, min + (mean - min) * 0.5, mean, mean, mean + (max - mean) * 0.5, max];
    }

    if (titleEl) titleEl.textContent = chartTitle;

    this.charts.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: seriesLabel,
          data: values,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#06b6d4',
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2.5
        }]
      },
      options: this.getBaseChartOptions(chartTitle, gridColor, textColor)
    });
  },

  renderCategoricalChart(catCols, gridColor, textColor) {
    const ctx = document.getElementById('chart-categorical');
    if (!ctx) return;

    if (this.charts.categorical) {
      this.charts.categorical.destroy();
    }

    const catCol = catCols.find(c => c.distribution && Object.keys(c.distribution).length > 0) || catCols[0];
    let labels = [];
    let values = [];

    if (catCol && catCol.distribution) {
      const sorted = Object.entries(catCol.distribution).slice(0, 6);
      labels = sorted.map(s => s[0]);
      values = sorted.map(s => s[1]);
    } else {
      labels = ['Segment Alpha', 'Segment Beta', 'Segment Gamma', 'Segment Delta'];
      values = [420, 310, 240, 180];
    }

    const titleEl = document.getElementById('chart-categorical-title');
    if (titleEl) titleEl.textContent = catCol ? `Breakdown by ${catCol.name}` : 'Segment Composition';

    this.charts.categorical = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Count',
          data: values,
          backgroundColor: [
            'rgba(16, 185, 129, 0.85)',
            'rgba(20, 184, 166, 0.85)',
            'rgba(168, 85, 247, 0.85)',
            'rgba(6, 182, 212, 0.85)',
            'rgba(245, 158, 11, 0.85)',
            'rgba(236, 72, 153, 0.85)'
          ],
          borderRadius: 6,
          borderWidth: 0
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor }
          },
          y: {
            grid: { display: false },
            ticks: { color: textColor, font: { weight: '500' } }
          }
        }
      }
    });
  },

  /**
   * Fix Bug 6 & Bug 8: Real dynamic numeric column correlation pairs & single-variable variance matrix fallback
   */
  renderCorrelationMatrix(columns, numCols, correlations) {
    const container = document.getElementById('correlation-matrix-container');
    if (!container) return;

    // Filter numeric columns loosely (Bug 8)
    const activeNumCols = numCols.slice(0, 6);

    if (activeNumCols.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-8 text-center text-slate-400">
          <i class="fa-solid fa-circle-info text-2xl mb-2 text-blue-500"></i>
          <p class="text-sm">No numeric features detected in this dataset to generate correlation pairs.</p>
        </div>
      `;
      return;
    }

    // If only 1 numeric column exists, render a single-variable variance profile (Bug 8 fix)
    if (activeNumCols.length === 1) {
      const singleCol = activeNumCols[0];
      container.innerHTML = `
        <div class="p-6 rounded-xl bg-slate-100 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 space-y-4">
          <div class="flex items-center justify-between">
            <span class="font-medium text-sm text-slate-800 dark:text-slate-200">Single Numeric Feature Detected: <strong>${singleCol.name}</strong></span>
            <span class="px-2.5 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">Variance Analysis</span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-400">Multivariate correlation requires $\\ge 2$ numeric columns. Showing statistical variance moments for <code>${singleCol.name}</code>.</p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div class="p-3 rounded-lg bg-slate-200/60 dark:bg-slate-800/50">
              <div class="text-xs text-slate-500 dark:text-slate-400">Mean</div>
              <div class="text-base font-semibold text-slate-800 dark:text-slate-100">${singleCol.mean ?? 'N/A'}</div>
            </div>
            <div class="p-3 rounded-lg bg-slate-200/60 dark:bg-slate-800/50">
              <div class="text-xs text-slate-500 dark:text-slate-400">Std Dev</div>
              <div class="text-base font-semibold text-slate-800 dark:text-slate-100">±${singleCol.std ?? '0'}</div>
            </div>
            <div class="p-3 rounded-lg bg-slate-200/60 dark:bg-slate-800/50">
              <div class="text-xs text-slate-500 dark:text-slate-400">Min</div>
              <div class="text-base font-semibold text-slate-800 dark:text-slate-100">${singleCol.min ?? '0'}</div>
            </div>
            <div class="p-3 rounded-lg bg-slate-200/60 dark:bg-slate-800/50">
              <div class="text-xs text-slate-500 dark:text-slate-400">Max</div>
              <div class="text-base font-semibold text-slate-800 dark:text-slate-100">${singleCol.max ?? '0'}</div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Build N x N correlation matrix grid
    let tableHtml = `
      <div class="overflow-x-auto">
        <table class="w-full text-xs text-center border-collapse">
          <thead>
            <tr>
              <th class="p-2.5 text-left font-medium text-slate-400 border-b border-slate-700/50">Feature</th>
              ${activeNumCols.map(c => `<th class="p-2.5 font-medium text-slate-300 border-b border-slate-700/50 max-w-[100px] truncate" title="${c.name}">${c.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    activeNumCols.forEach(rowCol => {
      tableHtml += `<tr><td class="p-2.5 text-left font-medium text-slate-300 border-b border-slate-800/40 max-w-[120px] truncate" title="${rowCol.name}"><strong>${rowCol.name}</strong></td>`;

      activeNumCols.forEach(colCol => {
        let score = 1.0;
        if (rowCol.name !== colCol.name) {
          const match = correlations.find(
            c => (c.col1 === rowCol.name && c.col2 === colCol.name) ||
                 (c.col1 === colCol.name && c.col2 === rowCol.name)
          );
          score = match ? match.score : 0.0;
        }

        // Color coding: Blue/Purple for positive, Rose/Amber for negative
        let bgStyle = 'background-color: rgba(59, 130, 246, 0.1); color: #94a3b8;';
        if (score === 1.0) {
          bgStyle = 'background-color: rgba(59, 130, 246, 0.4); color: #ffffff; font-weight: 700;';
        } else if (score > 0.6) {
          bgStyle = `background-color: rgba(16, 185, 129, ${Math.abs(score) * 0.5}); color: #10b981; font-weight: 600;`;
        } else if (score > 0.2) {
          bgStyle = `background-color: rgba(59, 130, 246, ${Math.abs(score) * 0.35}); color: #60a5fa;`;
        } else if (score < -0.4) {
          bgStyle = `background-color: rgba(239, 68, 68, ${Math.abs(score) * 0.45}); color: #f87171; font-weight: 600;`;
        } else if (score < 0) {
          bgStyle = `background-color: rgba(245, 158, 11, ${Math.abs(score) * 0.3}); color: #fbbf24;`;
        }

        tableHtml += `
          <td class="p-2 border-b border-slate-800/40 transition-all hover:scale-105" style="${bgStyle}" title="${rowCol.name} vs ${colCol.name}: r = ${score}">
            ${score.toFixed(2)}
          </td>
        `;
      });

      tableHtml += `</tr>`;
    });

    tableHtml += `</tbody></table></div>`;
    container.innerHTML = tableHtml;
  },

  getBaseChartOptions(title, gridColor, textColor) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 10,
          cornerRadius: 8,
          titleFont: { size: 13, weight: '600' }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, maxRotation: 45, minRotation: 0 }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor }
        }
      }
    };
  },

  /**
   * Render Column Profiler Table with Search & Pagination
   */
  renderColumnTable(profile) {
    const tbody = document.getElementById('columns-table-body');
    const paginationInfo = document.getElementById('columns-pagination-info');
    const paginationControls = document.getElementById('columns-pagination-controls');
    if (!tbody) return;

    let columns = profile.columns || [];

    // Filter by Type
    if (this.columnTableState.typeFilter === 'numeric') {
      columns = columns.filter(c => ApiService.isNum(c));
    } else if (this.columnTableState.typeFilter === 'categorical') {
      columns = columns.filter(c => ApiService.isCat(c));
    }

    // Filter by Search Query
    if (this.columnTableState.searchQuery) {
      const q = this.columnTableState.searchQuery.toLowerCase();
      columns = columns.filter(c => c.name.toLowerCase().includes(q) || (c.dtype && c.dtype.toLowerCase().includes(q)));
    }

    const totalCols = columns.length;
    const totalPages = Math.ceil(totalCols / this.columnTableState.pageSize) || 1;
    if (this.columnTableState.currentPage > totalPages) this.columnTableState.currentPage = 1;

    const startIdx = (this.columnTableState.currentPage - 1) * this.columnTableState.pageSize;
    const pageCols = columns.slice(startIdx, startIdx + this.columnTableState.pageSize);

    if (pageCols.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-slate-400">
            No columns match the current filter or search criteria.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = pageCols.map(col => {
        const isNum = ApiService.isNum(col);
        const dtypeBadgeClass = isNum
          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20';

        const completeness = (100 - (col.null_percentage || 0)).toFixed(1);
        const completenessColor = completeness >= 95 ? 'bg-emerald-500' : completeness >= 80 ? 'bg-amber-500' : 'bg-rose-500';

        let statsSummary = '';
        if (isNum && col.mean !== undefined) {
          statsSummary = `Mean: ${col.mean} | Min: ${col.min} | Max: ${col.max}`;
        } else if (col.distribution) {
          const topKeys = Object.keys(col.distribution).slice(0, 2).join(', ');
          statsSummary = `Top: ${topKeys || 'N/A'}`;
        } else {
          statsSummary = `Unique: ${col.unique_count || 'N/A'}`;
        }

        return `
          <tr class="border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-100/70 dark:hover:bg-slate-800/20 transition-colors">
            <td class="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
              <div class="flex items-center gap-2">
                <i class="fa-solid ${isNum ? 'fa-hashtag text-blue-500 dark:text-blue-400' : 'fa-font text-purple-500 dark:text-purple-400'} text-xs"></i>
                <span>${col.name}</span>
              </div>
            </td>
            <td class="py-3 px-4">
              <span class="px-2 py-0.5 rounded text-xs font-mono font-medium ${dtypeBadgeClass}">
                ${col.dtype}
              </span>
            </td>
            <td class="py-3 px-4">
              <div class="flex items-center gap-2">
                <div class="w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div class="h-full ${completenessColor} rounded-full" style="width: ${completeness}%"></div>
                </div>
                <span class="text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">${completeness}%</span>
              </div>
            </td>
            <td class="py-3 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">
              ${col.null_count || 0} (${col.null_percentage || 0}%)
            </td>
            <td class="py-3 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">
              ${col.unique_count || 'N/A'}
            </td>
            <td class="py-3 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 font-mono">
              ${statsSummary}
            </td>
          </tr>
        `;
      }).join('');
    }

    if (paginationInfo) {
      const displayEnd = Math.min(startIdx + this.columnTableState.pageSize, totalCols);
      paginationInfo.textContent = `Showing ${totalCols > 0 ? startIdx + 1 : 0}-${displayEnd} of ${totalCols} columns`;
    }

    if (paginationControls) {
      paginationControls.innerHTML = `
        <button 
          class="px-2.5 py-1 text-xs rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
          ${this.columnTableState.currentPage <= 1 ? 'disabled' : ''}
          onclick="Dashboard.setColumnPage(${this.columnTableState.currentPage - 1})">
          <i class="fa-solid fa-chevron-left mr-1"></i> Prev
        </button>
        <span class="text-xs text-slate-400 px-2">Page ${this.columnTableState.currentPage} of ${totalPages}</span>
        <button 
          class="px-2.5 py-1 text-xs rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
          ${this.columnTableState.currentPage >= totalPages ? 'disabled' : ''}
          onclick="Dashboard.setColumnPage(${this.columnTableState.currentPage + 1})">
          Next <i class="fa-solid fa-chevron-right ml-1"></i>
        </button>
      `;
    }
  },

  setColumnPage(page) {
    this.columnTableState.currentPage = Math.max(1, page);
    if (window.App && window.App.state.currentAnalysis) {
      this.renderColumnTable(window.App.state.currentAnalysis.profile);
    }
  },

  /**
   * Render Filterable AI Insights Feed
   */
  renderInsights(profile) {
    const container = document.getElementById('insights-feed-container');
    if (!container) return;

    let insights = profile.insights || [];

    if (this.insightFilter !== 'all') {
      insights = insights.filter(ins => (ins.category || '').toLowerCase() === this.insightFilter.toLowerCase());
    }

    if (insights.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-slate-400 text-sm">
          No insights found under the "${this.insightFilter}" category filter.
        </div>
      `;
      return;
    }

    container.innerHTML = insights.map((ins, idx) => {
      let cardClass = 'p-3.5 bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 rounded-r-lg';
      let titleClass = 'text-xs font-bold text-blue-800 dark:text-blue-400 uppercase tracking-tight';
      let categoryTag = ins.category || 'INSIGHT';

      if (ins.type === 'trend') {
        cardClass = 'p-3.5 bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-indigo-500 rounded-r-lg';
        titleClass = 'text-xs font-bold text-indigo-800 dark:text-indigo-400 uppercase tracking-tight';
      } else if (ins.type === 'correlation') {
        cardClass = 'p-3.5 bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 rounded-r-lg';
        titleClass = 'text-xs font-bold text-blue-800 dark:text-blue-400 uppercase tracking-tight';
      } else if (ins.type === 'anomaly') {
        cardClass = 'p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-emerald-500 rounded-r-lg';
        titleClass = 'text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-tight';
      } else if (ins.type === 'distribution' || ins.type === 'quality') {
        cardClass = 'p-3.5 bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 rounded-r-lg';
        titleClass = 'text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-tight';
      }

      return `
        <div class="${cardClass} transition-all space-y-1">
          <div class="flex items-center justify-between">
            <p class="${titleClass}">${ins.title || categoryTag}</p>
            <span class="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase font-semibold">${ins.badge || 'Verified'}</span>
          </div>
          <p class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">${ins.description}</p>
          ${ins.recommendation ? `
            <div class="pt-1.5 mt-1 border-t border-black/5 dark:border-white/5 flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
              <i class="fa-solid fa-bullseye text-blue-500 mt-0.5 shrink-0"></i>
              <span><strong>Action:</strong> ${ins.recommendation}</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  /**
   * Render Raw Data Preview Table (First 8 Rows)
   */
  renderDataPreview(profile) {
    const thead = document.getElementById('preview-table-head');
    const tbody = document.getElementById('preview-table-body');
    if (!thead || !tbody) return;

    const columns = profile.columns || [];
    const rows = profile.sample_rows || [];

    if (columns.length === 0 || rows.length === 0) {
      tbody.innerHTML = `<tr><td class="text-center py-6 text-slate-400">No raw records available for preview.</td></tr>`;
      return;
    }

    thead.innerHTML = `
      <tr>
        <th class="py-2.5 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-left">#</th>
        ${columns.map(c => `<th class="py-2.5 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 text-left truncate max-w-[140px]">${c.name}</th>`).join('')}
      </tr>
    `;

    tbody.innerHTML = rows.slice(0, 8).map((row, idx) => `
      <tr class="border-b border-slate-200 dark:border-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/20 text-xs">
        <td class="py-2.5 px-3 text-slate-500 font-mono">${idx + 1}</td>
        ${columns.map(c => `<td class="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-mono truncate max-w-[140px]">${row[c.name] !== undefined ? row[c.name] : '-'}</td>`).join('')}
      </tr>
    `).join('');
  },

  /**
   * PDF Report Generator using html2pdf.js
   */
  exportToPDF(filename) {
    const element = document.getElementById('dashboard-content-container');
    if (!element) {
      alert('Dashboard content container not found for PDF export.');
      return;
    }

    if (typeof html2pdf === 'undefined') {
      alert('html2pdf library is loading or unavailable. Please check internet connection.');
      return;
    }

    const opt = {
      margin: 10,
      filename: `${filename || 'AI_Data_Analyst_Report'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save();
  },

  /**
   * Interactive Chart Maker Sandbox
   */
  initChartMaker(dataset) {
    if (!dataset || !dataset.profile) return;
    const columns = dataset.profile.columns || [];
    const numCols = columns.filter(c => ApiService.isNum(c));
    const catCols = columns.filter(c => ApiService.isCat(c));

    const xSelect = document.getElementById('cm-x-axis');
    const ySelect = document.getElementById('cm-y-axis');
    const hueSelect = document.getElementById('cm-hue-axis');
    if (!xSelect || !ySelect) return;

    xSelect.innerHTML = columns.map((c, i) => `<option value="${c.name}">${c.name} (${c.dtype})</option>`).join('');
    
    ySelect.innerHTML = (numCols.length > 0 ? numCols : columns).map((c, i) => 
      `<option value="${c.name}" ${i === 1 || (i === 0 && numCols.length === 1) ? 'selected' : ''}>${c.name} (${c.dtype})</option>`
    ).join('');

    if (hueSelect) {
      hueSelect.innerHTML = `<option value="none">No Hue (Single Color)</option>` + 
        catCols.map(c => `<option value="${c.name}">${c.name} (Categorical)</option>`).join('');
    }

    this.renderCustomChart();
  },

  renderCustomChart() {
    const canvas = document.getElementById('chartmaker-canvas');
    const customContainer = document.getElementById('chartmaker-custom-container');
    if (!canvas) return;

    if (this.charts.customChart) {
      try {
        this.charts.customChart.destroy();
      } catch (e) {
        // ignore error
      }
      this.charts.customChart = null;
    }

    const type = document.getElementById('cm-chart-type')?.value || 'bar';
    const xCol = document.getElementById('cm-x-axis')?.value;
    const yCol = document.getElementById('cm-y-axis')?.value;
    const hueColVal = document.getElementById('cm-hue-axis')?.value;
    const groupCol = (!hueColVal || hueColVal === 'none') ? null : hueColVal;
    const palette = document.getElementById('cm-palette')?.value || 'emerald';
    const aggregation = document.getElementById('cm-aggregation')?.value || 'sum';

    const dataset = window.App ? window.App.state.currentAnalysis : null;
    if (!dataset || !dataset.profile) return;

    // Route 1: Univariate Distributions (Histogram, KDE, Hist+KDE)
    if (type === 'histogram' || type === 'kde' || type === 'histkde') {
      canvas.classList.remove('hidden');
      if (customContainer) customContainer.classList.add('hidden');
      if (typeof AdvancedVisualizations !== 'undefined') {
        const res = AdvancedVisualizations.renderUnivariateDistribution('chartmaker-canvas', dataset, {
          col: yCol || xCol,
          groupCol: groupCol,
          plotType: type,
          bins: 12,
          palette: palette
        });
        if (res?.chart) this.charts.customChart = res.chart;
      }
      return;
    }

    // Route 2: Scatter Plot & Regression
    if (type === 'scatter') {
      canvas.classList.remove('hidden');
      if (customContainer) customContainer.classList.add('hidden');
      if (typeof AdvancedVisualizations !== 'undefined') {
        const res = AdvancedVisualizations.renderScatterPlot('chartmaker-canvas', dataset, {
          xCol,
          yCol,
          groupCol: groupCol,
          palette: palette,
          showRegression: true
        });
        if (res?.chart) this.charts.customChart = res.chart;
      }
      return;
    }

    // Route 3: Box & Whisker Tukey Plot
    if (type === 'boxplot') {
      canvas.classList.add('hidden');
      if (customContainer) {
        customContainer.classList.remove('hidden');
        if (typeof AdvancedVisualizations !== 'undefined') {
          AdvancedVisualizations.renderBoxPlot('chartmaker-custom-container', dataset, {
            metricCol: yCol || xCol,
            groupCol: groupCol || (ApiService.isCat({ name: xCol }) ? xCol : null),
            palette: palette
          });
        }
      }
      return;
    }

    // Route 4: Pair Plot Matrix
    if (type === 'pairplot') {
      canvas.classList.add('hidden');
      if (customContainer) {
        customContainer.classList.remove('hidden');
        if (typeof AdvancedVisualizations !== 'undefined') {
          AdvancedVisualizations.renderPairPlot('chartmaker-custom-container', dataset, {
            groupCol: groupCol,
            diagType: 'kde',
            palette: palette
          });
        }
      }
      return;
    }

    // Route 5: Joint Distribution Plot
    if (type === 'jointplot') {
      canvas.classList.add('hidden');
      if (customContainer) {
        customContainer.classList.remove('hidden');
        if (typeof AdvancedVisualizations !== 'undefined') {
          AdvancedVisualizations.renderJointPlot('chartmaker-custom-container', dataset, {
            xCol: xCol,
            yCol: yCol,
            groupCol: groupCol,
            marginalType: 'kde',
            palette: palette
          });
        }
      }
      return;
    }

    // Default Standard Chart.js renderers (Bar, Line, Area, Pie, Doughnut)
    canvas.classList.remove('hidden');
    if (customContainer) customContainer.classList.add('hidden');

    const rows = (typeof AdvancedVisualizations !== 'undefined') 
      ? AdvancedVisualizations.getRecords(dataset) 
      : (dataset.records || dataset.profile?.records || dataset.profile?.sample_rows || []);
    
    const labels = [];
    const data = [];
    let datasetLabel = '';

    if (aggregation === 'none' || aggregation === 'raw') {
      // Plot raw unaggregated data points
      const sliceCount = Math.min(rows.length, 60);
      rows.slice(0, sliceCount).forEach((r, idx) => {
        const labelVal = xCol && r[xCol] !== undefined ? String(r[xCol]) : `Row ${idx + 1}`;
        const yVal = parseFloat(r[yCol]) || 0;
        labels.push(labelVal);
        data.push(yVal);
      });
      datasetLabel = xCol ? `${yCol} by ${xCol}` : `${yCol}`;
    } else {
      // Grouping & Aggregation (sum, avg, count, max, min)
      const groupMap = {};
      rows.forEach(r => {
        const xVal = xCol && r[xCol] !== undefined ? String(r[xCol]) : 'All Data';
        const yVal = parseFloat(r[yCol]) || 0;
        if (!groupMap[xVal]) groupMap[xVal] = [];
        groupMap[xVal].push(yVal);
      });

      Object.entries(groupMap).slice(0, 16).forEach(([key, values]) => {
        labels.push(key);
        if (aggregation === 'sum') {
          data.push(parseFloat(values.reduce((a, b) => a + b, 0).toFixed(2)));
        } else if (aggregation === 'avg') {
          data.push(parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)));
        } else if (aggregation === 'count') {
          data.push(values.length);
        } else if (aggregation === 'max') {
          data.push(Math.max(...values));
        } else {
          data.push(Math.min(...values));
        }
      });
      datasetLabel = `${aggregation.toUpperCase()}(${yCol}) by ${xCol || 'Category'}`;
    }

    const isDark = document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const palObj = (typeof CONFIG !== 'undefined' && CONFIG.getPalette) ? CONFIG.getPalette(palette) : null;
    const themeColors = palObj?.colors || CONFIG.CHART_COLORS;
    const primaryColor = palObj?.primary || '#10b981';

    this.charts.customChart = new Chart(canvas, {
      type: type === 'area' ? 'line' : type,
      data: {
        labels,
        datasets: [{
          label: datasetLabel,
          data,
          backgroundColor: type === 'pie' || type === 'doughnut'
            ? themeColors
            : type === 'area'
              ? `${primaryColor}33`
              : `${primaryColor}cc`,
          borderColor: primaryColor,
          borderWidth: 1.5,
          fill: type === 'area'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 750,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: { display: type === 'pie' || type === 'doughnut', position: 'bottom' }
        },
        scales: type === 'pie' || type === 'doughnut' ? {} : {
          x: { grid: { color: gridColor }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor } }
        }
      }
    });
  },

  /**
   * Advanced Visualizations Studio on Dashboard View
   */
  renderAdvancedVisualizations(dataset) {
    if (!dataset || !dataset.profile) return;
    const columns = dataset.profile.columns || [];
    const numCols = columns.filter(c => ApiService.isNum(c));
    const catCols = columns.filter(c => ApiService.isCat(c));

    // 1. Populate Scatter Controls
    const scatterXSelect = document.getElementById('adv-scatter-x');
    const scatterYSelect = document.getElementById('adv-scatter-y');
    const scatterGroupSelect = document.getElementById('adv-scatter-group');
    if (scatterXSelect && scatterYSelect) {
      scatterXSelect.innerHTML = numCols.map((c, i) => `<option value="${c.name}" ${i === 0 ? 'selected' : ''}>${c.name}</option>`).join('');
      scatterYSelect.innerHTML = numCols.map((c, i) => `<option value="${c.name}" ${i === 1 || (i === 0 && numCols.length === 1) ? 'selected' : ''}>${c.name}</option>`).join('');
      if (scatterGroupSelect) {
        scatterGroupSelect.innerHTML = `<option value="none">No Grouping (Single Color)</option>` + 
          catCols.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
      }
    }

    // 2. Populate Univariate Controls
    const univMetricSelect = document.getElementById('adv-univ-metric');
    const univGroupSelect = document.getElementById('adv-univ-group');
    if (univMetricSelect) {
      univMetricSelect.innerHTML = numCols.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
      if (univGroupSelect) {
        univGroupSelect.innerHTML = `<option value="none">Overall Dataset (Single Distribution)</option>` +
          catCols.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
      }
    }

    // 3. Populate Box Plot Controls
    const boxMetricSelect = document.getElementById('adv-box-metric');
    const boxGroupSelect = document.getElementById('adv-box-group');
    if (boxMetricSelect && boxGroupSelect) {
      boxMetricSelect.innerHTML = numCols.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
      boxGroupSelect.innerHTML = `<option value="none">Overall Dataset (Single Box)</option>` + 
        catCols.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }

    // 4. Populate Pair Plot Controls
    const pairGroupSelect = document.getElementById('adv-pair-group');
    if (pairGroupSelect) {
      pairGroupSelect.innerHTML = `<option value="none">No Hue (Single Color)</option>` +
        catCols.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }

    // 5. Populate Joint Plot Controls
    const jointXSelect = document.getElementById('adv-joint-x');
    const jointYSelect = document.getElementById('adv-joint-y');
    const jointGroupSelect = document.getElementById('adv-joint-group');
    if (jointXSelect && jointYSelect) {
      jointXSelect.innerHTML = numCols.map((c, i) => `<option value="${c.name}" ${i === 0 ? 'selected' : ''}>${c.name}</option>`).join('');
      jointYSelect.innerHTML = numCols.map((c, i) => `<option value="${c.name}" ${i === 1 || (i === 0 && numCols.length === 1) ? 'selected' : ''}>${c.name}</option>`).join('');
      if (jointGroupSelect) {
        jointGroupSelect.innerHTML = `<option value="none">No Hue (Single Color)</option>` +
          catCols.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
      }
    }

    // Render the currently selected advanced tab
    this.switchAdvTab(this.advVizState.activeTab || 'scatter');
  },

  switchAdvTab(tab) {
    this.advVizState.activeTab = tab;
    const tabs = ['scatter', 'univariate', 'boxplot', 'pairplot', 'jointplot'];

    tabs.forEach(t => {
      const btn = document.getElementById(`adv-tab-${t}`);
      const pane = document.getElementById(`adv-pane-${t}`);
      if (btn) {
        if (t === tab) {
          btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow-sm transition-all whitespace-nowrap';
        } else {
          btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all whitespace-nowrap';
        }
      }
      if (pane) {
        if (t === tab) {
          pane.classList.remove('hidden');
        } else {
          pane.classList.add('hidden');
        }
      }
    });

    const dataset = (window.App && window.App.state && window.App.state.currentAnalysis) ? window.App.state.currentAnalysis : (this.currentDataset || null);
    if (!dataset || typeof AdvancedVisualizations === 'undefined') return;

    setTimeout(() => {
      if (tab === 'scatter') {
        this.updateScatterPlot();
      } else if (tab === 'univariate') {
        this.updateUnivariatePlot();
      } else if (tab === 'boxplot') {
        this.updateBoxPlot();
      } else if (tab === 'pairplot') {
        this.updatePairPlot();
      } else if (tab === 'jointplot') {
        this.updateJointPlot();
      }
    }, 40);
  },

  updateScatterPlot() {
    const dataset = (window.App && window.App.state.currentAnalysis) ? window.App.state.currentAnalysis : (this.currentDataset || null);
    if (!dataset || typeof AdvancedVisualizations === 'undefined') return;

    const xCol = document.getElementById('adv-scatter-x')?.value;
    const yCol = document.getElementById('adv-scatter-y')?.value;
    const groupCol = document.getElementById('adv-scatter-group')?.value;
    const palette = document.getElementById('adv-scatter-palette')?.value || 'emerald';
    const showReg = document.getElementById('adv-scatter-regression')?.checked !== false;

    const res = AdvancedVisualizations.renderScatterPlot('adv-scatter-canvas', dataset, {
      xCol,
      yCol,
      groupCol: groupCol === 'none' ? null : groupCol,
      palette,
      showRegression: showReg
    });

    const formulaEl = document.getElementById('adv-scatter-formula');
    if (formulaEl && res?.stats) {
      formulaEl.textContent = `Y = ${res.stats.slope.toFixed(2)}X + ${res.stats.intercept.toFixed(2)} | R² = ${res.stats.r2.toFixed(3)} (r = ${res.stats.r.toFixed(2)})`;
    }
  },

  updateUnivariatePlot() {
    const dataset = (window.App && window.App.state.currentAnalysis) ? window.App.state.currentAnalysis : (this.currentDataset || null);
    if (!dataset || typeof AdvancedVisualizations === 'undefined') return;

    const metricCol = document.getElementById('adv-univ-metric')?.value;
    const groupCol = document.getElementById('adv-univ-group')?.value;
    const plotType = document.getElementById('adv-univ-type')?.value || 'histkde';
    const bins = parseInt(document.getElementById('adv-univ-bins')?.value || '12', 10);
    const palette = document.getElementById('adv-univ-palette')?.value || 'emerald';

    AdvancedVisualizations.renderUnivariateDistribution('adv-univariate-canvas', dataset, {
      col: metricCol,
      groupCol: groupCol === 'none' ? null : groupCol,
      plotType,
      bins,
      palette
    });
  },

  updateBoxPlot() {
    const dataset = (window.App && window.App.state.currentAnalysis) ? window.App.state.currentAnalysis : (this.currentDataset || null);
    if (!dataset || typeof AdvancedVisualizations === 'undefined') return;

    const metricCol = document.getElementById('adv-box-metric')?.value;
    const groupCol = document.getElementById('adv-box-group')?.value;
    const palette = document.getElementById('adv-box-palette')?.value || 'emerald';

    AdvancedVisualizations.renderBoxPlot('adv-boxplot-container', dataset, {
      metricCol,
      groupCol: groupCol === 'none' ? null : groupCol,
      palette
    });
  },

  updatePairPlot() {
    const dataset = (window.App && window.App.state.currentAnalysis) ? window.App.state.currentAnalysis : (this.currentDataset || null);
    if (!dataset || typeof AdvancedVisualizations === 'undefined') return;

    const groupCol = document.getElementById('adv-pair-group')?.value;
    const diagType = document.getElementById('adv-pair-diag')?.value || 'kde';
    const palette = document.getElementById('adv-pair-palette')?.value || 'emerald';

    AdvancedVisualizations.renderPairPlot('adv-pairplot-container', dataset, {
      groupCol: groupCol === 'none' ? null : groupCol,
      diagType,
      palette
    });
  },

  updateJointPlot() {
    const dataset = (window.App && window.App.state.currentAnalysis) ? window.App.state.currentAnalysis : (this.currentDataset || null);
    if (!dataset || typeof AdvancedVisualizations === 'undefined') return;

    const xCol = document.getElementById('adv-joint-x')?.value;
    const yCol = document.getElementById('adv-joint-y')?.value;
    const groupCol = document.getElementById('adv-joint-group')?.value;
    const marginalType = document.getElementById('adv-joint-marginal')?.value || 'kde';
    const palette = document.getElementById('adv-joint-palette')?.value || 'emerald';

    AdvancedVisualizations.renderJointPlot('adv-jointplot-container', dataset, {
      xCol,
      yCol,
      groupCol: groupCol === 'none' ? null : groupCol,
      marginalType,
      palette
    });
  }
};

window.Dashboard = Dashboard;