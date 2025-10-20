// Global callback for Turnstile widget (referenced in HTML)
window.onTurnstileReady = function(token) {
    console.log('🔒 HTML Turnstile widget ready with token:', token ? 'YES' : 'NO');
    // Store the token for later use
    if (window.searchManager) {
        window.searchManager.htmlTurnstileToken = token;
        window.searchManager.turnstileReady = true;
        console.log('✅ Turnstile token stored in searchManager');
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
        
        // Turnstile security - use HTML widget instead of programmatic
        this.htmlTurnstileToken = null;
        this.turnstileReady = false;
        
        // Autoplay state
        this.autoplayEnabled = true;
        this.currentPlayer = null;
        this.playerState = {
            isPlaying: false,
            isMuted: false,
            currentVideoId: null
        };
        
        // Initialize Turnstile when ready
        this.initTurnstile();
    }
    
    initTurnstile() {
        console.log('🔒 Initializing Turnstile (using HTML widget)...');
        
        // Check if the HTML widget container exists
        const widgetContainer = document.getElementById('turnstile-widget');
        if (!widgetContainer) {
            console.error('❌ Turnstile widget container not found in HTML');
            this.turnstileReady = false;
            return;
        }
        
        console.log('✅ Found HTML Turnstile widget container');
        
        // Check if Turnstile script is loaded
        if (window.turnstile) {
            console.log('✅ Turnstile script already loaded');
            this.turnstileReady = true;
        } else {
            // Wait for Turnstile script to load
            let attempts = 0;
            const checkTurnstile = setInterval(() => {
                attempts++;
                if (window.turnstile) {
                    clearInterval(checkTurnstile);
                    console.log('✅ Turnstile script loaded after waiting');
                    this.turnstileReady = true;
                } else if (attempts > 50) {
                    clearInterval(checkTurnstile);
                    console.warn('⚠️ Turnstile script failed to load');
                    this.turnstileReady = false;
                }
            }, 100);
        }
    }
    
    // Remove the renderTurnstile method since we're using the HTML widget
    
    async getTsToken() {
        // Always fetch a fresh token
        if (!this.turnstileReady || !window.turnstile) {
            console.warn('Turnstile not ready, proceeding without token');
            return null;
        }
        try {
            console.log('🔒 Requesting fresh Turnstile token...');
            
            // Reset the widget first to clear any previous execution state
            try {
                window.turnstile.reset('#turnstile-widget');
                console.log('🔄 Reset Turnstile widget before execute');
            } catch (resetError) {
                console.log('Reset not needed or failed:', resetError);
            }
            
            // Execute with explicit widget selector
            const token = await window.turnstile.execute('#turnstile-widget');
            this.htmlTurnstileToken = token; // store only for debugging/logs
            console.log('🔒 Got fresh Turnstile token:', token ? 'YES' : 'NO');
            return token;
        } catch (error) {
            console.warn('Turnstile token generation failed, proceeding without token:', error);
            return null;
        }
    }

    clearTurnstileToken() {
        this.htmlTurnstileToken = null;
        try {
            if (window.turnstile && typeof window.turnstile.reset === 'function') {
                window.turnstile.reset('#turnstile-widget'); // reset the widget so it can issue a new token
            }
        } catch (e) {
            // no-op
        }
    }

    async searchShorts(query) {
        if (!query || query.trim() === '') {
            window.speechManager.speak('Please enter a search term');
            return [];
        }

        try {
            console.log(`🔍 Starting YouTube search for: "${query}"`);
            this.showLoading('Searching videos');
            
            // Get fresh Turnstile token using proper pattern
            const token = await this.getTsToken();
            
            const results = await this.searchCloudflareShorts(query, token);
            
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

    // Cloudflare Worker Shorts Search with token refresh and one retry
    async searchCloudflareShorts(query, initialToken) {
        const doRequest = async (token) => {
            console.log('📹 Searching videos via Cloudflare Worker...');
            const url = `${this.shortsEndpoint}?q=${encodeURIComponent(query)}&limit=50`;
            console.log('🔗 Worker request URL:', url);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.searchTimeout);

            const headers = {
                'Accept': 'application/json',
                'Origin': window.location.origin
            };
            
            // Debug: Log the token value we received
            console.log('🔍 Token parameter received in doRequest:', token ? 'YES' : 'NO');
            
            if (token) {
                console.log('🔒 Including Turnstile token in request');
                headers['cf-turnstile-response'] = token;
            } else {
                console.warn('⚠️ No Turnstile token available, proceeding anyway');
            }

            const startTime = Date.now();
            const response = await fetch(url, { method: 'GET', headers, signal: controller.signal });
            clearTimeout(timeoutId);
            console.log('📊 Worker response status:', response.status);
            console.log('⏱️ Request took:', Date.now() - startTime, 'ms');
            return response;
        };

        // Debug: Log initial token value
        console.log('🔍 Initial token:', initialToken ? 'YES' : 'NO');
        
        let token = initialToken || await this.getTsToken();
        
        // Debug: Log final token value before first request
        console.log('🔍 Token before first request:', token ? 'YES' : 'NO');
        
        let response = await doRequest(token);

        // If token was rejected, clear, fetch a new one, and retry once
        if (response.status === 401 || response.status === 403) {
            console.warn('🔁 Token rejected, refreshing token and retrying once...');
            this.clearTurnstileToken();
            token = await this.getTsToken();
            
            // Debug: Log retry token value
            console.log('🔍 Retry token:', token ? 'YES' : 'NO');
            
            response = await doRequest(token);
        }

        // After the request cycle, clear the token so we never reuse it
        this.clearTurnstileToken();

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error('❌ Worker API error:', response.status, errorText);
            if (response.status === 404) {
                throw new Error('Search service temporarily unavailable');
            } else if (response.status === 401 || response.status === 403) {
                throw new Error('Access denied - please refresh the page');
            } else if (response.status >= 500) {
                throw new Error('Search service error - please try again');
            } else {
                throw new Error(`Search failed with error ${response.status}`);
            }
        }

        const responseText = await response.text();
        console.log('📄 Raw response length:', responseText.length, 'characters');

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            throw new Error('Received invalid data from search service');
        }

        if (!data || !Array.isArray(data.items)) {
            console.warn('⚠️ Unexpected data format from search service');
            return [];
        }

        console.log('📊 Raw items count from worker:', data.items.length);
        console.log('🔄 Processing', data.items.length, 'items...');

        const results = [];
        data.items.forEach((item, index) => {
            if (item && item.videoId) {
                results.push({
                    videoId: item.videoId,
                    title: item.title || `Video ${index + 1}`,
                    author: item.channelTitle || 'YouTube',
                    thumbnail: `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
                    url: `https://www.youtube.com/watch?v=${item.videoId}`
                });
                console.log(`✅ Added video ${index + 1}: ${results[results.length - 1].title} (${item.videoId})`);
            } else {
                console.log(`❌ Skipped item ${index + 1} due to missing videoId`);
            }
        });

        console.log('🎉 Successfully processed', results.length, 'videos');
        return results;
    }

    // Load YouTube API once and cache it
    async loadYouTubeAPI() {
        return new Promise((resolve) => {
            if (window.YT && YT.Player) {
                console.log('YouTube API already loaded');
                return resolve();
            }
            
            console.log('Loading YouTube API...');
            
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

    // Play a video by videoId - let YouTube API manage everything
    async playVideoId(videoId) {
        console.log('🎥 Playing video ID:', videoId);
        
        try {
            // Ensure API is loaded
            await this.loadYouTubeAPI();
            
            // Destroy previous player instance (important!)
            if (this.ytPlayer && this.ytPlayer.destroy) {
                try {
                    console.log('Destroying previous player instance');
                    this.ytPlayer.destroy();
                } catch (e) {
                    console.log('Error destroying player:', e);
                }
                this.ytPlayer = null;
            }
            
            // Create new player - let YouTube API create the iframe
            console.log('Creating new YouTube player for host element');
            this.ytPlayer = new YT.Player('youtube-player-host', {
                width: '100%',
                height: '100%',
                videoId: videoId,
                playerVars: {
                    autoplay: 1,
                    mute: 1,                // Start muted for autoplay compliance, but will unmute after ready
                    playsinline: 1,
                    rel: 0,
                    modestbranding: 1,
                    controls: 0,            // Hide default controls since we have our own
                    fs: 0,                  // No fullscreen
                    iv_load_policy: 3,      // No annotations
                    disablekb: 1,           // No keyboard controls
                    // CRITICAL: Must match exact origin
                    origin: window.location.origin,
                    enablejsapi: 1
                },
                events: {
                    onReady: (event) => {
                        console.log('✅ YouTube player ready');
                        this.onPlayerReady(event);
                    },
                    onStateChange: (event) => {
                        console.log('🔄 Player state change:', event.data);
                        this.onPlayerStateChange(event);
                    },
                    onError: (event) => {
                        console.error('❌ YouTube player error:', event.data);
                        this.onPlayerError(event);
                    }
                }
            });
            
            // Update our state - videos will start unmuted
            this.playerState = {
                isPlaying: true,    // Will start playing when ready
                isMuted: false,     // Will be unmuted automatically after ready
                currentVideoId: videoId
            };
            
        } catch (error) {
            console.error('❌ Error playing video:', error);
            window.speechManager.speak('player error');
            this.handleVideoError();
        }
    }
    
    onPlayerReady(event) {
        try {
            console.log('Player ready - starting playback and auto-unmuting');
            const player = event.target;
            
            // Start muted for autoplay compliance, then unmute after a brief delay
            player.mute();
            player.playVideo();
            
            // Auto-unmute after player starts (gives time for autoplay to work)
            setTimeout(() => {
                try {
                    player.unMute();
                    player.setVolume(50); // Set reasonable volume
                    console.log('🔊 Auto-unmuted video and set volume to 50%');
                    this.playerState.isMuted = false;
                    
                    // Update button labels
                    this.updatePlayerButtons();
                } catch (error) {
                    console.log('Could not auto-unmute video:', error);
                    this.playerState.isMuted = true;
                }
            }, 1000); // Wait 1 second for autoplay to establish
            
            console.log('✅ Player initialized successfully');
            
        } catch (error) {
            console.error('Error in onPlayerReady:', error);
        }
    }
    
    onPlayerStateChange(event) {
        const state = event.data;
        
        switch (state) {
            case YT.PlayerState.UNSTARTED:
                this.playerState.isPlaying = false;
                break;
            case YT.PlayerState.ENDED:
                console.log('Video ended, auto-advancing...');
                this.playerState.isPlaying = false;
                if (this.autoplayEnabled) {
                    setTimeout(() => {
                        this.autoAdvanceToNext();
                    }, 1500);
                }
                break;
            case YT.PlayerState.PLAYING:
                this.playerState.isPlaying = true;
                break;
            case YT.PlayerState.PAUSED:
                this.playerState.isPlaying = false;
                break;
            case YT.PlayerState.BUFFERING:
                // Don't change state during buffering
                break;
            case YT.PlayerState.CUED:
                this.playerState.isPlaying = false;
                break;
        }
        
        // Update button labels after state change
        this.updatePlayerButtons();
    }
    
    onPlayerError(event) {
        const errorCode = event.data;
        console.error('❌ YouTube player error code:', errorCode);
        
        let shouldSkip = true;
        
        switch (errorCode) {
            case 2:
                console.log('Invalid video ID, silently skipping to next video');
                break;
            case 5:
                console.log('HTML5 player error, silently skipping to next video');
                break;
            case 100:
                console.log('Video not found or private, silently skipping to next video');
                break;
            case 101:
            case 150:
                console.log('Video not embeddable, silently skipping to next video');
                break;
            default:
                console.log('Unknown video error, silently skipping to next video');
                break;
        }
        
        // No TTS announcement - just silently skip
        
        if (shouldSkip) {
            // Mark current video as unplayable
            this.markVideoAsUnplayable(this.currentShortsIndex);
            
            // Try to skip to next playable video immediately (no delay)
            this.skipToNextPlayableVideo();
        }
    }
    
    markVideoAsUnplayable(index) {
        if (this.shortsResults[index]) {
            this.shortsResults[index].unplayable = true;
            console.log(`❌ Marked video ${index + 1} as unplayable: ${this.shortsResults[index].title}`);
        }
    }
    
    findNextPlayableVideo(startIndex, direction = 1) {
        const totalVideos = this.shortsResults.length;
        if (totalVideos === 0) return -1;
        
        let attempts = 0;
        let currentIndex = startIndex;
        
        // Try to find a playable video within reasonable attempts
        while (attempts < totalVideos) {
            currentIndex = direction > 0 
                ? (currentIndex + 1) % totalVideos
                : (currentIndex - 1 + totalVideos) % totalVideos;
            
            const video = this.shortsResults[currentIndex];
            if (video && !video.unplayable) {
                console.log(`✅ Found playable video at index ${currentIndex}: ${video.title}`);
                return currentIndex;
            }
            
            attempts++;
        }
        
        console.log('❌ No playable videos found in results');
        return -1;
    }
    
    skipToNextPlayableVideo() {
        const nextIndex = this.findNextPlayableVideo(this.currentShortsIndex, 1);
        
        if (nextIndex !== -1) {
            this.currentShortsIndex = nextIndex;
            const nextVideo = this.shortsResults[nextIndex];
            console.log(`⏭️ Silently skipping to next playable video: ${nextVideo.title}`);
            this.playVideoId(nextVideo.videoId);
        } else {
            // All videos are unplayable - only speak if absolutely no videos work
            console.log('❌ All videos in search results are unplayable');
            window.speechManager.speak('No playable videos found');
            
            // Close the video player
            setTimeout(() => {
                if (window.narbe && window.narbe.closeShortsFeed) {
                    window.narbe.closeShortsFeed();
                }
            }, 2000);
        }
    }
    
    skipToPreviousPlayableVideo() {
        const prevIndex = this.findNextPlayableVideo(this.currentShortsIndex, -1);
        
        if (prevIndex !== -1) {
            this.currentShortsIndex = prevIndex;
            const prevVideo = this.shortsResults[prevIndex];
            console.log(`⏮️ Silently skipping to previous playable video: ${prevVideo.title}`);
            this.playVideoId(prevVideo.videoId);
        } else {
            // No TTS - just silently stay on current video
            console.log('No previous playable videos available');
        }
    }
    
    handleVideoError() {
        // Mark current video as unplayable and try next one silently
        this.markVideoAsUnplayable(this.currentShortsIndex);
        this.skipToNextPlayableVideo();
    }

    // Update button labels based on current state
    updatePlayerButtons() {
        const playPauseBtn = document.querySelector('[data-action="shorts_play_pause"]');
        const muteBtn = document.querySelector('[data-action="shorts_mute_toggle"]');
        
        if (playPauseBtn) {
            playPauseBtn.textContent = this.playerState.isPlaying ? 'PAUSE' : 'PLAY';
        }
        
        if (muteBtn && this.ytPlayer && this.ytPlayer.isMuted) {
            const actuallyMuted = this.ytPlayer.isMuted();
            muteBtn.textContent = actuallyMuted ? 'UNMUTE' : 'MUTE';
        } else if (muteBtn) {
            muteBtn.textContent = this.playerState.isMuted ? 'UNMUTE' : 'MUTE';
        }
    }
    
    // Control methods using YouTube API
    togglePlayPause() {
        if (!this.ytPlayer || !this.ytPlayer.getPlayerState) {
            console.log('❌ No YouTube player available');
            window.speechManager.speak('player not ready');
            return;
        }
        
        try {
            const state = this.ytPlayer.getPlayerState();
            console.log('Current player state:', state);
            
            if (state === YT.PlayerState.PLAYING) {
                console.log('▶️ Pausing video');
                this.ytPlayer.pauseVideo();
                this.playerState.isPlaying = false;
                window.speechManager.speak('paused');
            } else if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.CUED) {
                console.log('⏸️ Playing video');
                this.ytPlayer.playVideo();
                this.playerState.isPlaying = true;
                window.speechManager.speak('playing');
            } else {
                console.log('🔄 Player in transitional state, trying to play');
                this.ytPlayer.playVideo();
                this.playerState.isPlaying = true;
                window.speechManager.speak('playing');
            }
            
            // Update button labels immediately
            this.updatePlayerButtons();
            
        } catch (error) {
            console.error('❌ Error in togglePlayPause:', error);
            window.speechManager.speak('play pause failed');
        }
    }
    
    toggleMute() {
        if (!this.ytPlayer || !this.ytPlayer.isMuted) {
            console.log('❌ No YouTube player available');
            window.speechManager.speak('player not ready');
            return;
        }
        
        try {
            const isMuted = this.ytPlayer.isMuted();
            console.log('Current mute state:', isMuted);
            
            if (isMuted) {
                console.log('🔊 Unmuting video');
                this.ytPlayer.unMute();
                // Set reasonable volume
                if (this.ytPlayer.setVolume) {
                    this.ytPlayer.setVolume(50);
                }
                this.playerState.isMuted = false;
                window.speechManager.speak('unmuted');
            } else {
                console.log('🔇 Muting video');
                this.ytPlayer.mute();
                this.playerState.isMuted = true;
                window.speechManager.speak('muted');
            }
            
            // Update button labels immediately
            this.updatePlayerButtons();
            
        } catch (error) {
            console.error('❌ Error in toggleMute:', error);
            window.speechManager.speak('mute toggle failed');
        }
    }
    
    rewindVideo() {
        if (!this.ytPlayer || !this.ytPlayer.getCurrentTime || !this.ytPlayer.seekTo) {
            console.log('❌ No YouTube player available for rewind');
            window.speechManager.speak('player not ready');
            return;
        }
        
        try {
            const currentTime = this.ytPlayer.getCurrentTime();
            const newTime = Math.max(0, currentTime - 10); // Go back 10 seconds, but not below 0
            
            console.log(`⏪ Rewinding from ${currentTime}s to ${newTime}s`);
            this.ytPlayer.seekTo(newTime, true);
            window.speechManager.speak('rewind');
            
        } catch (error) {
            console.error('❌ Error in rewindVideo:', error);
            window.speechManager.speak('rewind failed');
        }
    }
    
    fastForwardVideo() {
        if (!this.ytPlayer || !this.ytPlayer.getCurrentTime || !this.ytPlayer.seekTo || !this.ytPlayer.getDuration) {
            console.log('❌ No YouTube player available for fast forward');
            window.speechManager.speak('player not ready');
            return;
        }
        
        try {
            const currentTime = this.ytPlayer.getCurrentTime();
            const duration = this.ytPlayer.getDuration();
            const newTime = Math.min(duration, currentTime + 10); // Go forward 10 seconds, but not beyond video end
            
            console.log(`⏩ Fast forwarding from ${currentTime}s to ${newTime}s (duration: ${duration}s)`);
            this.ytPlayer.seekTo(newTime, true);
            window.speechManager.speak('fast forward');
            
        } catch (error) {
            console.error('❌ Error in fastForwardVideo:', error);
            window.speechManager.speak('fast forward failed');
        }
    }

    // Navigation methods - now work with videoId
    getCurrentVideoId() {
        if (this.shortsResults && this.shortsResults[this.currentShortsIndex]) {
            return this.shortsResults[this.currentShortsIndex].videoId;
        }
        return null;
    }
    
    nextShorts() {
        if (this.shortsResults.length > 0) {
            this.currentShortsIndex = (this.currentShortsIndex + 1) % this.shortsResults.length;
            const currentVideo = this.shortsResults[this.currentShortsIndex];
            console.log(`Next video: ${this.currentShortsIndex + 1}/${this.shortsResults.length} - ${currentVideo?.title}`);
            return this.currentShortsIndex;
        }
        return 0;
    }
    
    prevShorts() {
        if (this.shortsResults.length > 0) {
            this.currentShortsIndex = (this.currentShortsIndex - 1 + this.shortsResults.length) % this.shortsResults.length;
            const currentVideo = this.shortsResults[this.currentShortsIndex];
            console.log(`Previous video: ${this.currentShortsIndex + 1}/${this.shortsResults.length} - ${currentVideo?.title}`);
            return this.currentShortsIndex;
        }
        return 0;
    }

    autoAdvanceToNext() {
        // Only auto-advance if we're still in the overlay
        const shortsFeed = document.getElementById('shorts-feed');
        if (shortsFeed && !shortsFeed.classList.contains('hidden')) {
            console.log(`Auto-advancing to next video...`);
            
            const nextIndex = this.findNextPlayableVideo(this.currentShortsIndex, 1);
            if (nextIndex !== -1) {
                this.currentShortsIndex = nextIndex;
                const nextVideo = this.shortsResults[nextIndex];
                console.log(`Loading next playable video: ${nextVideo.title}`);
                this.playVideoId(nextVideo.videoId);
            } else {
                console.log('No more playable videos for auto-advance');
                // Only speak if we reach the absolute end
                window.speechManager.speak('End of videos');
            }
        }
    }
    
    loadNewVideo() {
        const videoId = this.getCurrentVideoId();
        if (videoId) {
            const currentVideo = this.shortsResults[this.currentShortsIndex];
            if (currentVideo && currentVideo.unplayable) {
                console.log('Current video marked as unplayable, finding alternative...');
                this.skipToNextPlayableVideo();
            } else {
                console.log('🔄 Loading new video:', videoId);
                this.playVideoId(videoId);
            }
        }
    }
    
    // Simplified setup method
    setupPlayer() {
        console.log('🎬 Setting up initial player...');
        const videoId = this.getCurrentVideoId();
        if (videoId) {
            this.playVideoId(videoId);
        } else {
            console.error('❌ No video ID available for setup');
        }
    }
    
    cleanup() {
        console.log('🧹 Cleaning up player...');
        
        // Destroy YouTube player properly
        if (this.ytPlayer) {
            try {
                console.log('Destroying YouTube player...');
                this.ytPlayer.destroy();
            } catch (error) {
                console.log('Error destroying player:', error);
            }
            this.ytPlayer = null;
        }
        
        // Reset state
        this.playerState = {
            isPlaying: false,
            isMuted: true,
            currentVideoId: null
        };
        
        console.log('✅ Cleanup complete');
    }

    handleSearchError(type, error) {
        console.error(`${type} search error:`, error);
        
        if (error.message.includes('403') || error.message.includes('quotaExceeded')) {
            window.speechManager.speak(`${type} search quota exceeded. Try again later.`);
        } else if (error.message.includes('400') || error.message.includes('invalid')) {
            window.speechManager.speak(`Invalid ${type} search request.`);
        } else if (error.message.includes('timeout')) {
            window.speechManager.speak(`${type} search timed out. Check connection.`);
        } else {
            window.speechManager.speak(`${type} search failed. Try again.`);
        }
    }

    // Utility methods
    showLoading(message) {
        const overlay = document.getElementById('loading-overlay');
        const label = document.getElementById('loading-label');
        
        if (overlay && label) {
            label.textContent = message || 'Loading...';
            overlay.classList.remove('hidden');
        }
    }
    
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
}

// Global search manager instance
window.searchManager = new SearchManager();