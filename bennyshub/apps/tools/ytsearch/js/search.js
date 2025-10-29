// Robust Turnstile initialization and token management
// Singleton state with correct sitekey
const TS_STATE = {
  scriptLoaded: false,
  scriptPromise: null,
  widgetId: null,
  widgetReadyPromise: null,
  sitekey: "0x4AAAAAAB7n5nabkWl0WOPa",  // Correct production sitekey for narbehouse.github.io
};

// 1) Load the Turnstile script exactly once
function loadTurnstileScript() {
  if (TS_STATE.scriptPromise) return TS_STATE.scriptPromise;
  TS_STATE.scriptPromise = new Promise((resolve, reject) => {
    // If it is already present, resolve after ready() fires
    if (window.turnstile && window.turnstile.ready) {
      TS_STATE.scriptLoaded = true;
      return window.turnstile.ready(resolve);
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.defer = true;
    s.onload = () => {
      TS_STATE.scriptLoaded = true;
      window.turnstile.ready(resolve);
    };
    s.onerror = () => reject(new Error("Failed to load Turnstile script"));
    document.head.appendChild(s);
  });
  return TS_STATE.scriptPromise;
}

// HTML Widget Token Manager - Works with existing HTML Turnstile widget
const TurnstileTokenManager = (() => {
    let currentToken = null;
    let inFlight = null;
    let widgetId = null;
    let ready = false;
    let initPromise = null;

    // Initialize by finding the existing HTML widget - deterministic sequence
    function init() {
        if (initPromise) return initPromise;
        
        initPromise = new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 10 seconds max
            
            const checkWidget = () => {
                attempts++;
                
                // First ensure Turnstile script is loaded
                if (!window.turnstile) {
                    if (attempts < maxAttempts) {
                        setTimeout(checkWidget, 100);
                        return;
                    } else {
                        reject(new Error("Turnstile script failed to load"));
                        return;
                    }
                }
                
                const widget = document.querySelector('.cf-turnstile');
                if (widget) {
                    // Try to get widget ID from various sources
                    widgetId = widget.dataset.widgetId || widget.getAttribute('data-widget-id');
                    
                    if (widgetId) {
                        ready = true;
                        console.log('🔒 Found existing HTML Turnstile widget with ID:', widgetId);
                        resolve();
                    } else {
                        // Widget exists but ID not set yet, wait longer
                        if (attempts < maxAttempts) {
                            setTimeout(checkWidget, 100);
                        } else {
                            reject(new Error("Widget ID never became available"));
                        }
                    }
                } else {
                    // No widget found yet, keep checking
                    if (attempts < maxAttempts) {
                        setTimeout(checkWidget, 100);
                    } else {
                        reject(new Error("No Turnstile widget found in DOM"));
                    }
                }
            };
            
            checkWidget();
        });
        
        return initPromise;
    }

    // Set token from HTML widget callback
    function setToken(token) {
        currentToken = token;
        console.log('🔒 Token received from HTML widget callback:', token ? 'YES' : 'NO');
        inFlight = null; // Clear any pending execute
    }

    // Clear token
    function clearToken() {
        currentToken = null;
        console.log('🔒 Token cleared');
    }

    // Execute the existing HTML widget - serialized to prevent race conditions
    async function executeWidget() {
        await init(); // Ensure widget is ready
        
        if (!ready || !widgetId || !window.turnstile) {
            throw new Error("Turnstile widget not ready");
        }

        // Serialize execute calls to prevent "already executing" errors
        if (!inFlight) {
            inFlight = new Promise((resolve, reject) => {
                console.log('🔒 Starting fresh execute sequence');
                
                // Clear any existing token first
                currentToken = null;
                
                // Store original callback to restore later
                const originalCallback = window.onTurnstileToken;
                
                // Create a one-time callback for this execution
                const executeCallback = (token) => {
                    console.log('🔒 Execute callback received token');
                    currentToken = token;
                    inFlight = null;
                    
                    // Restore original callback and call it too for compatibility
                    window.onTurnstileToken = originalCallback;
                    if (originalCallback && typeof originalCallback === 'function') {
                        originalCallback(token);
                    }
                    
                    resolve(token);
                };
                
                // Set our temporary callback
                window.onTurnstileToken = executeCallback;

                try {
                    console.log('🔒 Resetting and executing HTML widget with ID:', widgetId);
                    window.turnstile.reset(widgetId);
                    
                    // Small delay to ensure reset completes before execute
                    setTimeout(() => {
                        try {
                            window.turnstile.execute(widgetId);
                        } catch (execError) {
                            console.error('🔒 Execute call failed:', execError);
                            window.onTurnstileToken = originalCallback;
                            inFlight = null;
                            reject(execError);
                        }
                    }, 200);
                } catch (e) {
                    console.error('🔒 Reset/Execute failed:', e);
                    window.onTurnstileToken = originalCallback;
                    inFlight = null;
                    reject(e);
                }

                // Timeout after 15 seconds
                setTimeout(() => {
                    if (inFlight) {
                        console.warn('🔒 Execute timeout after 15 seconds');
                        window.onTurnstileToken = originalCallback;
                        inFlight = null;
                        reject(new Error("Turnstile execute timeout"));
                    }
                }, 15000);
            });
        } else {
            console.log('🔒 Execute already in flight, waiting for existing call');
        }

        return inFlight;
    }

    async function tokenForRequest() {
        // Always execute to get a fresh token
        console.log('🔒 Getting fresh token for request');
        return executeWidget();
    }

    async function retryToken() {
        // Reset and execute again
        currentToken = null;
        inFlight = null; // Clear any existing in-flight to force new execute
        console.log('🔒 Retry: clearing state and executing fresh widget');
        return executeWidget();
    }

    return { 
        tokenForRequest, 
        retryToken, 
        setToken, 
        clearToken,
        init
    };
})();

// Keep original HTML callbacks but also integrate with token manager
const originalOnTurnstileToken = window.onTurnstileToken;
const originalOnTurnstileExpired = window.onTurnstileExpired;
const originalOnTurnstileError = window.onTurnstileError;

window.onTurnstileToken = (token) => {
    console.log('🔒 HTML Widget issued token via callback');
    TurnstileTokenManager.setToken(token);
    
    // Call the original callback if it exists
    if (originalOnTurnstileToken && typeof originalOnTurnstileToken === 'function') {
        originalOnTurnstileToken(token);
    }
    
    // Also call the searchManager method for compatibility
    if (window.searchManager && typeof window.searchManager._setToken === 'function') {
        window.searchManager._setToken(token);
    }
};

window.onTurnstileExpired = () => {
    console.log('⌛ Token expired');
    TurnstileTokenManager.clearToken();
    
    if (originalOnTurnstileExpired && typeof originalOnTurnstileExpired === 'function') {
        originalOnTurnstileExpired();
    }
    
    if (window.searchManager && typeof window.searchManager._clearToken === 'function') {
        window.searchManager._clearToken();
    }
};

window.onTurnstileError = (err) => {
    console.warn('⚠️ Turnstile error callback', err);
    TurnstileTokenManager.clearToken();
    
    if (originalOnTurnstileError && typeof originalOnTurnstileError === 'function') {
        originalOnTurnstileError(err);
    }
    
    if (window.searchManager && typeof window.searchManager._clearToken === 'function') {
        window.searchManager._clearToken();
    }
};

// YouTube Shorts search functionality
class SearchManager {
    constructor() {
        this.currentSearch = null;
        this.searchTimeout = 15000;
        this.shortsResults = [];
        this.currentShortsIndex = 0;
        
        // Updated Cloudflare Worker endpoint for shorts
        this.shortsEndpoint = 'https://dawn-star-cad3.narbehousellc.workers.dev/';
        
        // Autoplay state
        this.autoplayEnabled = true;
        this.currentPlayer = null;
        this.playerState = {
            isPlaying: false,
            isMuted: false,
            currentVideoId: null
        };
        
        // Legacy token properties for compatibility
        this.turnstileReady = false;
        this.htmlTurnstileToken = null;
        
        // Initialize connection to HTML widget
        this.initTurnstile();
    }
    
    initTurnstile() {
        console.log('🔒 Connecting to existing HTML Turnstile widget...');
        
        // Initialize the token manager
        TurnstileTokenManager.init();
        
        // Wait a bit for widget to be ready
        setTimeout(() => {
            this.turnstileReady = true;
            console.log('✅ Connected to HTML Turnstile widget');
        }, 1000);
    }

    // Legacy methods for compatibility with HTML callbacks
    _setToken(token) {
        this.htmlTurnstileToken = token;
        this.turnstileReady = true;
        console.log('🔒 Legacy: Token set via callback:', token ? 'YES' : 'NO');
    }

    _clearToken() {
        this.htmlTurnstileToken = null;
    }

    // Cloudflare Worker Shorts Search with robust token management
    async searchCloudflareShorts(query) {
        const url = `${this.shortsEndpoint}?q=${encodeURIComponent(query)}&limit=50`;
        console.log('📹 Searching videos via Cloudflare Worker...');
        console.log('🔗 Worker request URL:', url);

        const doRequest = async (token) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.searchTimeout);

            const headers = { 
                'Accept': 'application/json',
                // Always send desktop-like headers to avoid mobile API restrictions
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'cross-site'
            };
            
            if (token) {
                headers['cf-turnstile-response'] = token;
                console.log('🔒 Sending request with Turnstile token');
            } else {
                console.warn('⚠️ No Turnstile token available for request');
            }

            const t0 = Date.now();
            const res = await fetch(url, { 
                method: 'GET', 
                headers, 
                signal: controller.signal,
                credentials: 'omit',
                mode: 'cors'
            });
            clearTimeout(timeoutId);
            console.log('📊 Worker response status:', res.status);
            console.log('⏱️ Request took:', Date.now() - t0, 'ms');
            return res;
        };

        // Always get a fresh token before the request using robust token manager
        let token;
        try {
            token = await TurnstileTokenManager.tokenForRequest();
            console.log('🔒 Got fresh token for request');
        } catch (e) {
            console.warn("Could not get Turnstile token:", e);
            throw new Error("Access denied - please refresh the page");
        }

        let res = await doRequest(token);

        // On 401, retry with a brand new token
        if (res.status === 401) {
            console.warn("401 on first call, retrying with a brand new token...");
            try {
                const retryToken = await TurnstileTokenManager.retryToken();
                console.log('🔒 Got retry token');
                res = await doRequest(retryToken);
            } catch (e) {
                console.warn("Could not get retry token:", e);
                throw new Error("Access denied - please refresh the page");
            }
        }

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error('❌ Worker API error:', res.status, text);
            if (res.status === 401 || res.status === 403) {
                throw new Error('Access denied - please refresh the page');
            }
            if (res.status >= 500) {
                throw new Error('Search service error - try again');
            }
            throw new Error(`Access denied - server said ${res.status}: ${text || res.statusText}`);
        }

        const payload = await res.json().catch(() => null);
        if (!payload || !Array.isArray(payload.items)) {
            console.warn('⚠️ Unexpected response format:', payload);
            return [];
        }
        
        console.log('📊 Raw items count from worker:', payload.items.length);
        return payload.items.map((it, i) => ({
            videoId: it.videoId,
            title: it.title || `Video ${i + 1}`,
            author: it.channelTitle || 'YouTube',
            thumbnail: `https://i.ytimg.com/vi/${it.videoId}/hqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${it.videoId}`
        }));
    }

    async searchShorts(query) {
        if (!query || query.trim() === '') {
            window.speechManager.speak('Please enter a search term');
            return [];
        }

        try {
            console.log(`🔍 Starting YouTube search for: "${query}"`);
            this.showLoading('Searching videos');
            
            // Use new token flow
            const results = await this.searchCloudflareShorts(query);
            
            if (results.length > 0) {
                console.log(`✅ Found ${results.length} videos`);
                this.shortsResults = results;
                this.currentShortsIndex = 0;
                this.hideLoading();
                window.speechManager.speak(`Found ${results.length} videos`);
                
                return results;
            } else {
                console.log('❌ No videos found');
                this.hideLoading();
                window.speechManager.speak('No videos found');
                return [];
            }
            
        } catch (error) {
            console.error('❌ Video search failed:', error);
            this.hideLoading();
            this.handleSearchError('video search', error);
            return [];
        }
    }

    // Load YouTube API if not already loaded
    async loadYouTubeAPI() {
        return new Promise((resolve) => {
            // If API is already loaded and ready
            if (window.YT && window.YT.Player) {
                console.log('YouTube API already loaded and ready');
                resolve();
                return;
            }
            
            // Set up the callback before loading the script
            window.onYouTubeIframeAPIReady = () => {
                console.log('YouTube API ready callback fired');
                resolve();
            };
            
            // Load the API script if not already present
            if (!document.querySelector('script[src*="iframe_api"]')) {
                const script = document.createElement('script');
                script.src = 'https://www.youtube.com/iframe_api';
                script.async = true;
                document.head.appendChild(script);
            } else {
                // Script already exists, API should be ready soon
                setTimeout(() => resolve(), 100);
            }
        });
    }

    // Show loading overlay
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const label = document.getElementById('loading-label');
        if (overlay && label) {
            label.textContent = message;
            overlay.classList.remove('hidden');
        }
    }

    // Hide loading overlay
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    // Handle search errors
    handleSearchError(type, error) {
        console.error(`${type} search error:`, error);
        let message = `${type} search failed. Try again.`;
        
        if (error.message.includes('Access denied')) {
            message = 'Access denied. Please refresh the page.';
        } else if (error.message.includes('service error')) {
            message = 'Search service error. Try again in a moment.';
        }
        
        window.speechManager.speak(message);
    }
}
