/**
 * AI Data Analyst - Global Configuration
 */
const CONFIG = {
  APP_NAME: 'AI Data Analyst',
  VERSION: '2.5.0',
  API_BASE_URL: window.location.origin,
  
  // Storage Keys
  THEME_KEY: 'aida_theme',
  TOKEN_KEY: 'aida_auth_token',
  USER_KEY: 'aida_user',
  ACTIVE_DATASET_KEY: 'aida_active_dataset_id',
  ACTIVE_VIEW_KEY: 'aida_active_view',
  HISTORY_KEY: 'aida_analysis_history',
  SAVED_CHARTS_KEY: 'aida_saved_charts',
  CHAT_MESSAGES_KEY: 'aida_chat_messages',
  
  // Default Limits
  MAX_FILE_SIZE_MB: 50,
  MAX_PREVIEW_ROWS: 100,
  DEFAULT_PAGE_SIZE: 10,
  
  // Chart Colors Palette
  CHART_COLORS: [
    '#10b981', // Emerald
    '#14b8a6', // Teal
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#6366f1', // Indigo
    '#f97316', // Orange
    '#3b82f6', // Blue
    '#ef4444'  // Red
  ],

  // Scientific & Theme Color Palettes
  COLOR_PALETTES: {
    'emerald': {
      name: 'Emerald Luminous',
      colors: ['#10b981', '#14b8a6', '#059669', '#34d399', '#0d9488', '#6ee7b7', '#047857'],
      primary: '#10b981',
      gradient: ['#10b981', '#14b8a6']
    },
    'cyberpunk': {
      name: 'Cyberpunk Neon',
      colors: ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#d946ef'],
      primary: '#06b6d4',
      gradient: ['#06b6d4', '#d946ef']
    },
    'sunset': {
      name: 'Sunset Amber-Rose',
      colors: ['#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#fb923c', '#e11d48'],
      primary: '#f59e0b',
      gradient: ['#f59e0b', '#e11d48']
    },
    'viridis': {
      name: 'Viridis Bio',
      colors: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725', '#35b779'],
      primary: '#22a884',
      gradient: ['#440154', '#fde725']
    },
    'oceanic': {
      name: 'Oceanic Teal',
      colors: ['#0284c7', '#06b6d4', '#0d9488', '#10b981', '#38bdf8', '#0ea5e9', '#64748b'],
      primary: '#0284c7',
      gradient: ['#0284c7', '#10b981']
    },
    'amethyst': {
      name: 'Amethyst Radiant',
      colors: ['#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#7c3aed', '#c084fc', '#4f46e5'],
      primary: '#8b5cf6',
      gradient: ['#8b5cf6', '#ec4899']
    },
    'coolwarm': {
      name: 'Cool-Warm Divergent',
      colors: ['#3b82f6', '#60a5fa', '#93c5fd', '#fca5a5', '#f87171', '#ef4444', '#b91c1c'],
      primary: '#3b82f6',
      gradient: ['#3b82f6', '#ef4444']
    }
  },

  getPalette(name = 'emerald') {
    return this.COLOR_PALETTES[name] || this.COLOR_PALETTES['emerald'];
  }
};

// Export to window for global access
window.CONFIG = CONFIG;
