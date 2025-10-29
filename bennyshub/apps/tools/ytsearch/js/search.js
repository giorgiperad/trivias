// Robust Turnstile initialization and token management
// Singleton state
const TS_STATE = {
  scriptLoaded: false,
  scriptPromise: null,
  widgetId: null,
  widgetReadyPromise: null,
  sitekey: "0x4AAAAAAAhdJV0Zqhyv_kTz",  // Your production sitekey
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

// 2) Render the widget programmatically and capture widgetId
async function renderTurnstileWidget() {
  await loadTurnstileScript();
  if (TS_STATE.widgetReadyPromise) return TS_STATE.widgetReadyPromise;

  TS_STATE.widgetReadyPromise = new Promise((resolve, reject) => {
    try {
      // Look for existing container or create one
      let mount = document.getElementById("turnstile-widget") || document.getElementById("ts-container");
      if (!mount) {
        // Create container if it doesn't exist
        mount = document.createElement("div");
        mount.id = "ts-container";
        mount.style.display = "none"; // Hidden since we use invisible widget
        document.body.appendChild(mount);
      }

      // Ensure the mount is empty (avoid double render on SPA routes)
      mount.innerHTML = "";

      console.log('🔒 Rendering Turnstile widget programmatically...');
      
      // Render invisible widget so we can execute programmatically
      const wid = window.turnstile.render(mount, {
        sitekey: TS_STATE.sitekey,
        size: "invisible",
        callback: () => {
          // Callback only fires after execute; we just need widget ready now.
          console.log('🔒 Turnstile widget callback fired');
        },
        "error-callback": (e) => {
          console.warn("🔒 Turnstile widget error", e);
        }
      });

      if (!wid) return reject(new Error("Failed to render Turnstile widget"));
      TS_STATE.widgetId = wid;
      console.log('🔒 Turnstile widget rendered with ID:', wid);

      // A tiny ready delay so render settles before first execute
      setTimeout(resolve, 0);
    } catch (e) {
      reject(e);
    }
  });

  return TS_STATE.widgetReadyPromise;
}

// 3) Token manager that guarantees readiness and serializes execute()
const TurnstileTokenManager = (() => {
  let inFlight = null;

  async function ensureReady() {
    await renderTurnstileWidget();
    if (!TS_STATE.widgetId) throw new Error("Turnstile widget not ready");
  }

  async function getFresh() {
    await ensureReady();
    if (!inFlight) {
      inFlight = new Promise((resolve, reject) => {
        try { 
          console.log('🔒 Resetting Turnstile widget before execute');
          window.turnstile.reset(TS_STATE.widgetId); 
        } catch (e) {
          console.log('Reset error (non-fatal):', e);
        }
        
        console.log('🔒 Executing Turnstile widget...');
        window.turnstile.execute(TS_STATE.widgetId, {
          action: "search",
          callback: (token) => { 
            console.log('🔒 Turnstile execute completed with token');
            inFlight = null; 
            resolve(token); 
          },
          "error-callback": (err) => { 
            console.warn('🔒 Turnstile execute failed:', err);
            inFlight = null; 
            reject(err || new Error("execute failed")); 
          }
        });
      });
    }
    return inFlight;
  }

  async function tokenForRequest() { 
    return getFresh(); 
  }

  async function retryToken() {
    await ensureReady();
    try { 
      console.log('🔒 Resetting widget for retry');
      window.turnstile.reset(TS_STATE.widgetId); 
    } catch (e) {
      console.log('Reset error during retry (non-fatal):', e);
    }
    return getFresh();
  }

  return { tokenForRequest, retryToken, ensureReady };
})();

// Global callback for legacy HTML widget compatibility (if still present)
window.onTurnstileReady = function(token) {
    console.log('🔒 Legacy HTML Turnstile widget callback (ignored in favor of programmatic)');
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
        
        // Initialize Turnstile early
        this.initTurnstile();
    }
    
    initTurnstile() {
        console.log('🔒 Initializing robust Turnstile system...');
        
        // Kick off loading and rendering early to avoid "not ready" races
        renderTurnstileWidget()
            .then(() => {
                console.log('✅ Turnstile system ready');
            })
            .catch(e => {
                console.error('❌ Turnstile init failed:', e);
            });
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
}
