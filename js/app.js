/**
 * AI Data Analyst - Core Application Controller
 * Orchestrates State Management, Routing, File Ingestion,
 * Dockable AI Chat, History Persistence, and User Authentication.
 */

const App = {
  state: {
    user: null,
    activeView: 'landing',
    activeDatasetId: 'demo',
    currentAnalysis: null,
    history: [],
    savedCharts: [],
    chatMessages: [],
    isChatOpen: false,
    theme: 'dark'
  },

  /**
   * Application Lifecycle Entry Point
   */
  async init() {
    try {
      this.initTheme();
      this.bindEvents();
      await this.restoreState();
    } catch (err) {
      console.error('App init error:', err);
      if (!this.state.currentAnalysis) {
        this.state.currentAnalysis = (typeof DEMO_DATASET !== 'undefined') ? DEMO_DATASET : null;
      }
      this.switchView('dashboard');
    }
  },

  /**
   * Theme Initialization & Toggle
   */
  initTheme() {
    const savedTheme = localStorage.getItem(CONFIG.THEME_KEY) || 'dark';
    this.state.theme = savedTheme;
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    this.updateThemeButton();
  },

  toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      this.state.theme = 'light';
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      this.state.theme = 'dark';
    }
    localStorage.setItem(CONFIG.THEME_KEY, this.state.theme);
    this.updateThemeButton();

    // Re-render dashboard charts to update grid & text contrast
    if (this.state.currentAnalysis) {
      Dashboard.render(this.state.currentAnalysis);
    }
  },

  updateThemeButton() {
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
      icon.className = this.state.theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }
  },

  /**
   * Fix Bug 3: Make restoreState async and await loadDataset before switchView
   */
  async restoreState() {
    // Restore User Auth
    const savedUser = localStorage.getItem(CONFIG.USER_KEY);
    if (savedUser) {
      try {
        this.state.user = JSON.parse(savedUser);
        this.updateAuthUI();
      } catch (e) {
        console.error('Failed to parse saved user', e);
      }
    }

    // Restore History (Bug 9: Available for all guests & users)
    const savedHistory = localStorage.getItem(CONFIG.HISTORY_KEY);
    if (savedHistory) {
      try {
        this.state.history = JSON.parse(savedHistory);
      } catch (e) {
        this.state.history = [];
      }
    }

    // Restore Active Dataset & View
    const savedDatasetId = localStorage.getItem(CONFIG.ACTIVE_DATASET_KEY) || 'demo';
    const savedView = localStorage.getItem(CONFIG.ACTIVE_VIEW_KEY) || 'landing';

    this.state.activeDatasetId = savedDatasetId;

    // Load active dataset asynchronously before switching views
    if (savedDatasetId === 'demo') {
      this.state.currentAnalysis = DEMO_DATASET;
    } else {
      const cached = this.state.history.find(h => h.id === savedDatasetId);
      if (cached) {
        this.state.currentAnalysis = cached;
      } else {
        // Fallback to demo if specific ID is not cached
        this.state.activeDatasetId = 'demo';
        this.state.currentAnalysis = DEMO_DATASET;
      }
    }

    // Now switch view safely without overwriting dataset
    this.switchView(savedView);

    // Restore Chat Messages
    const savedChat = localStorage.getItem(CONFIG.CHAT_MESSAGES_KEY);
    if (savedChat) {
      try {
        this.state.chatMessages = JSON.parse(savedChat);
        this.renderChatMessages();
      } catch (e) {
        this.state.chatMessages = [];
      }
    } else {
      this.initDefaultChat();
    }
  },

  /**
   * View Routing Controller
   * Instant switching with 0 delay
   */
  switchView(viewName) {
    const views = ['landing', 'dashboard', 'chartmaker', 'askdata', 'history'];
    if (!views.includes(viewName)) viewName = 'landing';

    // Toggle View DOM Containers instantly
    views.forEach(v => {
      const el = document.getElementById(`${v}-view`);
      if (el) {
        if (v === viewName) {
          el.classList.remove('hidden');
          el.classList.add('block');
        } else {
          el.classList.remove('block');
          el.classList.add('hidden');
        }
      }

      // Update Nav Link Active States
      const navBtn = document.getElementById(`nav-${v}`);
      if (navBtn) {
        if (v === viewName) {
          navBtn.classList.add('bg-emerald-500/10', 'text-emerald-500', 'font-semibold');
          navBtn.classList.remove('text-slate-400', 'font-normal');
        } else {
          navBtn.classList.remove('bg-emerald-500/10', 'text-emerald-500', 'font-semibold');
          navBtn.classList.add('text-slate-400', 'font-normal');
        }
      }
    });

    this.state.activeView = viewName;
    localStorage.setItem(CONFIG.ACTIVE_VIEW_KEY, viewName);

    // View Specific Render Dispatchers (Instant)
    if (viewName === 'dashboard') {
      if (!this.state.currentAnalysis) {
        this.state.currentAnalysis = DEMO_DATASET;
        this.state.activeDatasetId = 'demo';
      }
      Dashboard.render(this.state.currentAnalysis);
    } else if (viewName === 'chartmaker') {
      if (!this.state.currentAnalysis) {
        this.state.currentAnalysis = DEMO_DATASET;
      }
      Dashboard.initChartMaker(this.state.currentAnalysis);
    } else if (viewName === 'history') {
      this.renderHistoryView();
    } else if (viewName === 'askdata') {
      this.renderAskDataView();
    }

    // Scroll to top instantly without smooth delay
    window.scrollTo(0, 0);
  },

  /**
   * File Ingestion & Drag-Drop Controller
   * Fixes Bugs 1, 2, 10, 11
   */
  async handleFile(file) {
    if (!file) return;

    // Check allowed file format (.csv and .xlsx only)
    const lowerName = file.name.toLowerCase();
    const isAllowedFormat = lowerName.endsWith('.csv') || lowerName.endsWith('.xlsx');
    if (!isAllowedFormat) {
      alert('Unsupported file format. Please upload a .csv or .xlsx file only.');
      return;
    }

    // Check size constraint
    const maxBytes = CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(`File size exceeds ${CONFIG.MAX_FILE_SIZE_MB}MB limit. Please upload a smaller dataset.`);
      return;
    }

    const overlay = document.getElementById('upload-overlay');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressPercent = document.getElementById('upload-progress-percent');
    const statusText = document.getElementById('upload-status-text');

    if (overlay) overlay.classList.remove('hidden');

    const updateProgress = (pct, msg) => {
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressPercent) progressPercent.textContent = `${pct}%`;
      if (statusText) statusText.textContent = msg;
    };

    let dataset = null;
    try {
      updateProgress(10, 'Initializing data ingestion pipeline...');

      // ApiService handles remote upload with automatic client-side fallback
      dataset = await ApiService.uploadDataset(file, (pct, msg) => updateProgress(pct, msg));

      if (!dataset || !dataset.profile) {
        throw new Error('Analysis produced empty profiling output.');
      }

      updateProgress(100, 'Ingestion complete! Loading dashboard...');

      // Store in State & History
      this.state.currentAnalysis = dataset;
      this.state.activeDatasetId = dataset.id;
      try {
        localStorage.setItem(CONFIG.ACTIVE_DATASET_KEY, dataset.id);
      } catch (e) {}

      // Add to History (avoid duplicates by ID)
      this.state.history = [dataset, ...this.state.history.filter(h => h.id !== dataset.id)];
      this.saveHistorySafely();

      // Fix Bug 2: Always redirect immediately to dashboard
      try {
        localStorage.setItem(CONFIG.ACTIVE_VIEW_KEY, 'dashboard');
      } catch (e) {}

      setTimeout(() => {
        if (overlay) overlay.classList.add('hidden');
        this.switchView('dashboard');
      }, 300);

    } catch (err) {
      console.error('File ingestion error:', err);
      alert(`Failed to analyze dataset: ${err.message || 'Unknown error'}`);
      if (overlay) overlay.classList.add('hidden');
    } finally {
      // Fix Bug 1 & Bug 11: Reset file inputs so re-uploading same file fires onchange
      const landingInput = document.getElementById('landing-file-input');
      const navInput = document.getElementById('nav-file-input');
      if (landingInput) landingInput.value = '';
      if (navInput) navInput.value = '';
    }
  },

  /**
   * Safe localStorage history persistence with quota management
   */
  saveHistorySafely() {
    try {
      const safeHistory = this.state.history.slice(0, 10).map(ds => {
        const copy = { ...ds };
        if (copy.records && copy.records.length > 200) {
          copy.records = copy.records.slice(0, 200);
        }
        if (copy.data && copy.data.length > 200) {
          copy.data = copy.data.slice(0, 200);
        }
        return copy;
      });
      localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(safeHistory));
    } catch (e) {
      console.warn('LocalStorage quota limit reached, trimming history cache...', e);
      try {
        const slim = this.state.history.slice(0, 4).map(ds => ({
          id: ds.id,
          filename: ds.filename,
          file_size: ds.file_size,
          uploaded_at: ds.uploaded_at,
          profile: ds.profile,
          sample_rows: ds.sample_rows || (ds.records ? ds.records.slice(0, 50) : [])
        }));
        localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(slim));
      } catch (err2) {
        console.warn('History saved in memory only due to browser storage quota.', err2);
      }
    }
  },

  loadDemoDataset() {
    this.state.currentAnalysis = DEMO_DATASET;
    this.state.activeDatasetId = 'demo';
    localStorage.setItem(CONFIG.ACTIVE_DATASET_KEY, 'demo');
    localStorage.setItem(CONFIG.ACTIVE_VIEW_KEY, 'dashboard');
    this.switchView('dashboard');
  },

  /**
   * Fix Bug 9: History accessible to all users (guests & authenticated)
   */
  renderHistoryView() {
    const listContainer = document.getElementById('history-list-container');
    const emptyContainer = document.getElementById('history-empty-state');
    const searchInput = document.getElementById('history-search-input');
    if (!listContainer) return;

    let items = this.state.history || [];

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (query) {
      items = items.filter(it => it.filename.toLowerCase().includes(query) || it.id.toLowerCase().includes(query));
    }

    if (items.length === 0) {
      listContainer.innerHTML = '';
      if (emptyContainer) emptyContainer.classList.remove('hidden');
      return;
    }

    if (emptyContainer) emptyContainer.classList.add('hidden');

    listContainer.innerHTML = items.map(item => {
      const isCurrent = this.state.activeDatasetId === item.id;
      const rows = item.profile.total_rows || item.profile.shape?.rows || 0;
      const cols = item.profile.columns?.length || item.profile.total_columns || 0;
      const score = item.profile.quality?.quality_score ?? item.profile.quality_score ?? 95.0;
      const date = item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent';

      return `
        <div class="p-5 rounded-2xl bg-white dark:bg-[#0F1929] border ${isCurrent ? 'border-emerald-500/60 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-800'} hover:border-emerald-500/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-start gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-lg shrink-0">
              <i class="fa-solid fa-file-csv"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-slate-800 dark:text-slate-100 text-base">${item.filename}</h3>
                ${isCurrent ? '<span class="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">Active</span>' : ''}
              </div>
              <div class="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span><i class="fa-solid fa-clock mr-1"></i>${date}</span>
                <span>•</span>
                <span>${rows.toLocaleString()} Rows</span>
                <span>•</span>
                <span>${cols} Columns</span>
                <span>•</span>
                <span class="text-emerald-500 font-medium">Quality: ${score}%</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 self-end md:self-auto">
            <button 
              onclick="App.restoreHistoryItem('${item.id}')" 
              class="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Dashboard
            </button>
            <button 
              onclick="App.deleteHistoryItem('${item.id}')" 
              class="p-2 rounded-xl text-xs text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 border border-slate-200 dark:border-slate-800 transition-all" 
              title="Delete from history">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  restoreHistoryItem(id) {
    const item = this.state.history.find(h => h.id === id);
    if (!item) return;

    this.state.currentAnalysis = item;
    this.state.activeDatasetId = item.id;
    localStorage.setItem(CONFIG.ACTIVE_DATASET_KEY, item.id);
    localStorage.setItem(CONFIG.ACTIVE_VIEW_KEY, 'dashboard');
    this.switchView('dashboard');
  },

  deleteHistoryItem(id) {
    if (!confirm('Are you sure you want to remove this dataset analysis from your history?')) return;
    this.state.history = this.state.history.filter(h => h.id !== id);
    this.saveHistorySafely();

    if (this.state.activeDatasetId === id) {
      this.state.currentAnalysis = DEMO_DATASET;
      this.state.activeDatasetId = 'demo';
      localStorage.setItem(CONFIG.ACTIVE_DATASET_KEY, 'demo');
    }
    this.renderHistoryView();
  },

  /**
   * Ask Data Full View Controller
   */
  renderAskDataView() {
    if (!this.state.chatMessages || this.state.chatMessages.length === 0) {
      this.initDefaultChat();
    } else {
      this.renderChatMessages();
    }
  },

  /**
   * Dockable AI Chat Controller
   */
  initDefaultChat() {
    this.state.chatMessages = [
      {
        id: 'msg-1',
        sender: 'agent',
        agentName: 'AI Data Analyst',
        badge: 'Enterprise Intelligence',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `👋 Welcome! I am your multi-agent analytical copilot. Ask me anything about your active dataset schema, run SQL calculations, or request strategic recommendations.`
      }
    ];
    this.renderChatMessages();
  },

  toggleChatDrawer() {
    const drawer = document.getElementById('chat-drawer');
    if (!drawer) return;

    this.state.isChatOpen = !this.state.isChatOpen;
    if (this.state.isChatOpen) {
      drawer.classList.remove('translate-x-full');
      drawer.classList.add('translate-x-0');
      document.getElementById('chat-input')?.focus();
    } else {
      drawer.classList.remove('translate-x-0');
      drawer.classList.add('translate-x-full');
    }
  },

  async handleSendMessage(inputElId = 'chat-input', messagesContainerId = 'chat-messages-body') {
    const input = document.getElementById(inputElId);
    if (!input || !input.value.trim()) return;

    const question = input.value.trim();
    input.value = '';

    // FIX: Always use the most current loaded analysis, not stale demo
    // If history has a real dataset matching the active ID, prefer it
    const savedId = localStorage.getItem(CONFIG.ACTIVE_DATASET_KEY);
    if (savedId && savedId !== 'demo') {
      const found = (this.state.history || []).find(h => h.id === savedId);
      if (found && this.state.currentAnalysis?.id === 'demo') {
        this.state.currentAnalysis = found;
      }
    }

    // Add User Message
    const userMsg = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: question
    };

    this.state.chatMessages.push(userMsg);
    this.renderChatMessages(messagesContainerId);

    // Show Typing Indicator
    const typingId = 'typing-' + Date.now();
    const typingMsg = {
      id: typingId,
      sender: 'agent',
      isTyping: true,
      agentName: 'AI Router',
      badge: 'Processing Query...',
      text: '<span class="inline-flex gap-1 items-center"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"></span><span class="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce [animation-delay:0.2s]"></span><span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:0.4s]"></span> Thinking...</span>'
    };

    this.state.chatMessages.push(typingMsg);
    this.renderChatMessages(messagesContainerId);

    // Call Multi-Agent AI Engine (Bug 4 & 5 fixes)
    try {
      const response = await ApiService.chatQuestion(question, this.state.currentAnalysis);

      // Remove typing indicator
      this.state.chatMessages = this.state.chatMessages.filter(m => m.id !== typingId);

      const agentMsg = {
        id: 'msg-' + Date.now(),
        sender: 'agent',
        agentName: response.agent || 'AI Analyst',
        badge: response.badge || 'Synthesized Intelligence',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: response.answer
      };

      this.state.chatMessages.push(agentMsg);
      localStorage.setItem(CONFIG.CHAT_MESSAGES_KEY, JSON.stringify(this.state.chatMessages));
      this.renderChatMessages(messagesContainerId);

    } catch (err) {
      this.state.chatMessages = this.state.chatMessages.filter(m => m.id !== typingId);
      this.state.chatMessages.push({
        id: 'msg-' + Date.now(),
        sender: 'agent',
        agentName: 'Error Handling Agent',
        badge: 'Failed',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `⚠️ Query resolution encountered an error: ${err.message || 'Unknown issue'}.`
      });
      this.renderChatMessages(messagesContainerId);
    }
  },

  renderChatMessages(preferredContainerId = null) {
    const targetContainers = preferredContainerId 
      ? [preferredContainerId, 'chat-messages-body', 'askdata-chat-messages'] 
      : ['chat-messages-body', 'askdata-chat-messages'];

    // Deduplicate IDs
    const uniqueIds = [...new Set(targetContainers)];

    uniqueIds.forEach(cid => {
      const container = document.getElementById(cid);
      if (!container) return;

      container.innerHTML = this.state.chatMessages.map(msg => {
        if (msg.sender === 'user') {
          return `
            <div class="flex justify-end mb-4">
              <div class="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3.5 shadow-md text-xs sm:text-sm">
                <p class="leading-relaxed whitespace-pre-wrap">${this.escapeHTML(msg.text)}</p>
                <span class="block text-[10px] text-emerald-100 text-right mt-1.5 font-mono">${msg.timestamp}</span>
              </div>
            </div>
          `;
        } else {
          const formattedHTML = msg.isTyping ? msg.text : this.renderMarkdownToHTML(msg.text);
          // Select appropriate icon per agent type
          let agentIcon = 'fa-solid fa-robot';
          let iconColor = 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';

          if (msg.agentName.includes('SQL')) {
            agentIcon = 'fa-solid fa-database';
            iconColor = 'text-purple-400 bg-purple-500/20 border-purple-500/30';
          } else if (msg.agentName.includes('Strategy') || msg.agentName.includes('Insight')) {
            agentIcon = 'fa-solid fa-lightbulb';
            iconColor = 'text-amber-400 bg-amber-500/20 border-amber-500/30';
          } else if (msg.agentName.includes('ML') || msg.agentName.includes('Predict')) {
            agentIcon = 'fa-solid fa-brain';
            iconColor = 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30';
          } else if (msg.agentName.includes('Stat') || msg.agentName.includes('Metric')) {
            agentIcon = 'fa-solid fa-chart-column';
            iconColor = 'text-teal-400 bg-teal-500/20 border-teal-500/30';
          } else if (msg.agentName.includes('Time') || msg.agentName.includes('Series')) {
            agentIcon = 'fa-solid fa-calendar-days';
            iconColor = 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
          }

          return `
            <div class="flex items-start gap-2.5 mb-4 animate-fade-in">
              <div class="w-8 h-8 rounded-xl ${iconColor} border flex items-center justify-center text-xs shrink-0 mt-0.5 bot-avatar-pulse shadow-sm">
                <i class="${agentIcon}"></i>
              </div>
              <div class="max-w-[90%] rounded-2xl rounded-tl-sm bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800/80 p-4 shadow-sm text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <div class="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-800">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span class="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">${msg.agentName}</span>
                  </div>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 font-mono">${msg.badge}</span>
                </div>
                <div class="chat-markdown-content leading-relaxed">${formattedHTML}</div>
                ${!msg.isTyping ? `<span class="block text-[10px] text-slate-400 text-right mt-2 font-mono">${msg.timestamp}</span>` : ''}
              </div>
            </div>
          `;
        }
      }).join('');

      // Scroll to bottom
      container.scrollTop = container.scrollHeight;
    });
  },

  /**
   * Lightweight Markdown Parser for SQL blocks, Tables, Bold, and Lists
   */
  renderMarkdownToHTML(markdown) {
    if (!markdown) return '';

    let html = markdown;

    // Code Blocks (SQL & Generic)
    html = html.replace(/```sql([\s\S]*?)```/g, (match, code) => {
      return `<div class="my-2.5 rounded-lg bg-slate-950 border border-slate-800 p-3 font-mono text-xs overflow-x-auto text-emerald-400"><div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-sans font-semibold"><i class="fa-solid fa-code mr-1"></i>SQL Query</div><code>${this.escapeHTML(code.trim())}</code></div>`;
    });

    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      return `<pre class="my-2.5 rounded-lg bg-slate-950 border border-slate-800 p-3 font-mono text-xs overflow-x-auto text-teal-300"><code>${this.escapeHTML(code.trim())}</code></pre>`;
    });

    // Inline Code
    html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-900 text-emerald-600 dark:text-emerald-300 font-mono text-xs border border-slate-300 dark:border-slate-800">$1</code>');

    // Tables: | Header | Header |
    html = html.replace(/(\|.+?\|\n\|[-:\s|]+?\n(?:\|.+?\|\n?)+)/g, (match) => {
      const lines = match.trim().split('\n');
      if (lines.length < 3) return match;

      const headers = lines[0].split('|').filter(c => c.trim() !== '').map(c => c.trim());
      const rows = lines.slice(2).map(line => line.split('|').filter(c => c.trim() !== '').map(c => c.trim()));

      let tableHtml = '<div class="my-2.5 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700/60"><table class="w-full text-xs text-left border-collapse bg-white dark:bg-slate-900/60">';
      tableHtml += '<thead><tr class="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">';
      headers.forEach(h => {
        tableHtml += `<th class="p-2 font-semibold text-slate-800 dark:text-slate-200">${h}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';

      rows.forEach(r => {
        tableHtml += '<tr class="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/30">';
        r.forEach(cell => {
          tableHtml += `<td class="p-2 text-slate-700 dark:text-slate-300">${cell}</td>`;
        });
        tableHtml += '</tr>';
      });

      tableHtml += '</tbody></table></div>';
      return tableHtml;
    });

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-slate-800 dark:text-slate-100 mt-2 mb-1">$1</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4 class="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2 mb-1">$1</h4>');

    // Blockquotes
    html = html.replace(/^> (.*$)/gim, '<blockquote class="pl-3 border-l-2 border-emerald-500 my-2 text-slate-700 dark:text-slate-300 text-xs italic bg-emerald-500/5 py-1 rounded-r">$1</blockquote>');

    // Bold & Italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-slate-900 dark:text-slate-100 font-semibold">$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em class="text-slate-700 dark:text-slate-300">$1</em>');

    // Unordered Lists
    html = html.replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc text-slate-700 dark:text-slate-300 my-0.5">$1</li>');
    html = html.replace(/^[0-9]+\. (.*$)/gim, '<li class="ml-4 list-decimal text-slate-700 dark:text-slate-300 my-0.5">$1</li>');

    // Paragraph Breaks
    html = html.replace(/\n\n/g, '<div class="h-2"></div>');

    return html;
  },

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  /**
   * User Authentication & Modal Controller
   * Fix Bug 12: Loading spinners and disabled states during auth actions
   */
  openAuthModal(mode = 'login') {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    this.switchAuthTab(mode);
  },

  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('hidden');
  },

  switchAuthTab(mode) {
    const loginForm = document.getElementById('login-form-container');
    const registerForm = document.getElementById('register-form-container');
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const titleEl = document.getElementById('auth-modal-title');
    const subTitleEl = document.getElementById('auth-modal-subtitle');

    if (mode === 'login') {
      if (loginForm) loginForm.classList.remove('hidden');
      if (registerForm) registerForm.classList.add('hidden');
      if (tabLogin) tabLogin.className = 'py-2 rounded-xl transition-all font-semibold bg-emerald-600 text-white shadow-sm flex items-center justify-center gap-1.5';
      if (tabRegister) tabRegister.className = 'py-2 rounded-xl transition-all font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1.5';
      if (titleEl) titleEl.textContent = 'Welcome Back';
      if (subTitleEl) subTitleEl.textContent = 'Sign in to access advanced AI analytics & saved datasets';
    } else {
      if (loginForm) loginForm.classList.add('hidden');
      if (registerForm) registerForm.classList.remove('hidden');
      if (tabRegister) tabRegister.className = 'py-2 rounded-xl transition-all font-semibold bg-emerald-600 text-white shadow-sm flex items-center justify-center gap-1.5';
      if (tabLogin) tabLogin.className = 'py-2 rounded-xl transition-all font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1.5';
      if (titleEl) titleEl.textContent = 'Create Analyst Account';
      if (subTitleEl) subTitleEl.textContent = 'Get started with in-browser AI analytics & custom chart engines';
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-submit-btn');
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    const origHTML = btn ? btn.innerHTML : 'Sign In';

    try {
      // Fix Bug 12: Visual Spinner Feedback
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Signing In...';
      }

      // Simulate network auth validation
      await new Promise(r => setTimeout(r, 600));

      const email = emailInput?.value || 'analyst@enterprise.ai';
      const user = {
        name: email.split('@')[0].toUpperCase(),
        email: email,
        token: 'jwt_' + Date.now(),
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
      };

      this.state.user = user;
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
      localStorage.setItem(CONFIG.TOKEN_KEY, user.token);

      this.updateAuthUI();
      this.closeAuthModal();

    } catch (err) {
      alert('Authentication error: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHTML;
      }
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('register-submit-btn');
    const nameInput = document.getElementById('register-name');
    const emailInput = document.getElementById('register-email');
    const origHTML = btn ? btn.innerHTML : 'Create Account';

    try {
      // Fix Bug 12: Visual Spinner Feedback
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Creating Account...';
      }

      await new Promise(r => setTimeout(r, 600));

      const name = nameInput?.value || 'Enterprise User';
      const email = emailInput?.value || 'user@enterprise.ai';
      const user = {
        name,
        email,
        token: 'jwt_' + Date.now()
      };

      this.state.user = user;
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
      localStorage.setItem(CONFIG.TOKEN_KEY, user.token);

      this.updateAuthUI();
      this.closeAuthModal();

    } catch (err) {
      alert('Registration error: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHTML;
      }
    }
  },

  handleLogout() {
    this.state.user = null;
    localStorage.removeItem(CONFIG.USER_KEY);
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    this.updateAuthUI();
  },

  updateAuthUI() {
    const authBtn = document.getElementById('header-auth-btn');
    const userProfileEl = document.getElementById('header-user-profile');
    const headerUserNameEl = document.getElementById('header-user-name');
    const headerUserAvatarEl = document.getElementById('header-user-avatar');
    const sidebarUserNameEl = document.getElementById('sidebar-user-name');
    const sidebarUserAvatarEl = document.getElementById('sidebar-user-avatar');

    if (this.state.user) {
      const name = this.state.user.name || 'Enterprise User';
      const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'EU';

      if (authBtn) authBtn.classList.add('hidden');
      if (userProfileEl) userProfileEl.classList.remove('hidden');
      if (headerUserNameEl) headerUserNameEl.textContent = name;
      if (headerUserAvatarEl) headerUserAvatarEl.textContent = initials;

      if (sidebarUserNameEl) sidebarUserNameEl.textContent = name;
      if (sidebarUserAvatarEl) sidebarUserAvatarEl.textContent = initials;
    } else {
      if (authBtn) authBtn.classList.remove('hidden');
      if (userProfileEl) userProfileEl.classList.add('hidden');

      if (sidebarUserNameEl) sidebarUserNameEl.textContent = 'Guest Analyst';
      if (sidebarUserAvatarEl) sidebarUserAvatarEl.textContent = 'GA';
    }
  },

  /**
   * Event Listeners Registration
   */
  bindEvents() {
    // Landing File Ingestion
    const landingInput = document.getElementById('landing-file-input');
    if (landingInput) {
      landingInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFile(e.target.files[0]);
        }
      });
    }

    // Top Nav File Ingestion
    const navInput = document.getElementById('nav-file-input');
    if (navInput) {
      navInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFile(e.target.files[0]);
        }
      });
    }

    // Drag and Drop Ingestion Box
    const dropZone = document.getElementById('landing-dropzone');
    if (dropZone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropZone.classList.add('border-emerald-500', 'bg-emerald-500/5');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropZone.classList.remove('border-emerald-500', 'bg-emerald-500/5');
        }, false);
      });

      dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt.files && dt.files[0]) {
          this.handleFile(dt.files[0]);
        }
      });
    }

    // Chat Drawer Resize Drag Handle
    this.initChatDrawerResize();
  },

  initChatDrawerResize() {
    const handle = document.getElementById('chat-drawer-resize-handle');
    const drawer = document.getElementById('chat-drawer');
    if (!handle || !drawer) return;

    let isResizing = false;
    let startX, startWidth;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = parseInt(document.defaultView.getComputedStyle(drawer).width, 10);
      document.documentElement.addEventListener('mousemove', onMouseMove, false);
      document.documentElement.addEventListener('mouseup', onMouseUp, false);
    });

    function onMouseMove(e) {
      if (!isResizing) return;
      const newWidth = startWidth - (e.clientX - startX);
      if (newWidth > 320 && newWidth < window.innerWidth * 0.85) {
        drawer.style.width = newWidth + 'px';
      }
    }

    function onMouseUp() {
      isResizing = false;
      document.documentElement.removeEventListener('mousemove', onMouseMove, false);
      document.documentElement.removeEventListener('mouseup', onMouseUp, false);
    }
  }
};

// Initialize Application on DOM Ready or immediately if already loaded
window.App = App;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
} else {
  App.init();
}
