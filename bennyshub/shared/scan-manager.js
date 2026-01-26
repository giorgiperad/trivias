/**
 * Unified Scan Manager for Narbehouse Accessibility Hub
 * Provides centralized scanning settings and logic helpers across all apps
 */

window.NarbeScanManager = (function() {
  'use strict';

  // Storage key for scan settings
  const STORAGE_KEY = 'narbe-scan-settings';
  
  // Available scan speeds in milliseconds
  const SCAN_SPEEDS = [1000, 2000, 3000, 4000];

  // Default settings
  const DEFAULT_SETTINGS = {
    autoScan: false,   // Default per agents.md (Off for Ben games)
    scanSpeedIndex: 1  // Default to 2000ms (index 1)
  };

  // Internal state
  let settings = { ...DEFAULT_SETTINGS };
  let observers = []; // For notifying games of setting changes

  /**
   * Load settings from localStorage
   */
  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate and merge
        settings = { ...DEFAULT_SETTINGS, ...parsed };
        
        // Ensure index is valid
        if (settings.scanSpeedIndex < 0 || settings.scanSpeedIndex >= SCAN_SPEEDS.length) {
          settings.scanSpeedIndex = DEFAULT_SETTINGS.scanSpeedIndex;
        }
      }
    } catch (error) {
      console.warn('NarbeScanManager: Error loading settings:', error);
      settings = { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Save settings to localStorage
   */
  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      notifyObservers();
    } catch (error) {
      console.error('NarbeScanManager: Error saving settings:', error);
    }
  }

  /**
   * Notify all registered observers of changes
   */
  function notifyObservers() {
    observers.forEach(callback => {
      try {
        callback(getPublicState());
      } catch (e) {
        console.error('NarbeScanManager: Error in observer callback:', e);
      }
    });
  }

  /**
   * Get current state for public consumption
   */
  function getPublicState() {
    return {
      autoScan: settings.autoScan,
      scanSpeedIndex: settings.scanSpeedIndex,
      scanInterval: SCAN_SPEEDS[settings.scanSpeedIndex]
    };
  }

  // Initialize
  loadSettings();

  // Listen for storage events from other windows/iframes
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      loadSettings();
      notifyObservers();
    }
  });

  // Public API
  return {
    /**
     * Force reload settings from storage
     */
    reload: function() {
      loadSettings();
      notifyObservers();
    },

    /**
     * Get current scan settings
     * @returns {Object} { autoScan, scanSpeedIndex, scanInterval }
     */
    getSettings: function() {
      return getPublicState();
    },

    /**
     * Get the actual scan interval in milliseconds
     * @returns {number} Milliseconds
     */
    getScanInterval: function() {
      return SCAN_SPEEDS[settings.scanSpeedIndex];
    },

    /**
     * Update multiple settings at once
     * @param {Object} newSettings Partial settings object
     */
    updateSettings: function(newSettings) {
      if (!newSettings) return;
      
      let changed = false;
      
      if (typeof newSettings.autoScan === 'boolean') {
        settings.autoScan = newSettings.autoScan;
        changed = true;
      }
      
      if (typeof newSettings.scanSpeedIndex === 'number' && 
          newSettings.scanSpeedIndex >= 0 && 
          newSettings.scanSpeedIndex < SCAN_SPEEDS.length) {
        settings.scanSpeedIndex = newSettings.scanSpeedIndex;
        changed = true;
      }
      
      if (changed) {
        saveSettings();
      }
    },

    /**
     * Set auto scan enabled/disabled
     * @param {boolean} enabled 
     */
    setAutoScan: function(enabled) {
      settings.autoScan = !!enabled;
      saveSettings();
    },

    /**
     * Toggle auto scan enabled/disabled
     */
    toggleAutoScan: function() {
      this.setAutoScan(!settings.autoScan);
    },

    /**
     * Set scan speed by index
     * @param {number} index 0-3 corresponding to 1s, 2s, 3s, 4s
     */
    setScanSpeedIndex: function(index) {
      if (index >= 0 && index < SCAN_SPEEDS.length) {
        settings.scanSpeedIndex = index;
        saveSettings();
      }
    },

    /**
     * Cycle to next scan speed
     */
    cycleScanSpeed: function() {
      let next = settings.scanSpeedIndex + 1;
      if (next >= SCAN_SPEEDS.length) next = 0;
      this.setScanSpeedIndex(next);
      return next;
    },

    /**
     * Subscribe to setting changes
     * @param {Function} callback Function to call when settings change
     */
    subscribe: function(callback) {
      if (typeof callback === 'function' && !observers.includes(callback)) {
        observers.push(callback);
      }
    },

    /**
     * Unsubscribe from setting changes
     * @param {Function} callback 
     */
    unsubscribe: function(callback) {
      observers = observers.filter(obs => obs !== callback);
    },

    /**
     * Helper to get available speeds
     */
    getAvailableSpeeds: function() {
      return [...SCAN_SPEEDS];
    }
  };
})();
