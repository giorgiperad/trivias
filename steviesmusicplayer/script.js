// Default playlist (will be loaded from JSON if LocalStorage is empty)
console.log("Stevie's Music Player v1.3 Loaded");
let playlist = [];
let localFileNames = {}; // Store names for blob URLs

let player = null; // YouTube Player Instance
let audioPlayer = new Audio(); // HTML5 Audio Player
let currentTrack = '';
let currentType = 'none'; // 'youtube' or 'audio'
let currentIndex = -1;
let consecutiveErrors = 0; // Track consecutive errors to prevent infinite loops

// State Tracking
let isPlayingState = false;
let isLoadingState = false;

// Themes
const themes = ['', 'theme-sunset', 'theme-dark', 'theme-forest', 'theme-candy'];
let currentThemeIndex = 0;

const CONFIG_VERSION = '1.1'; // Increment this to force-reset user playlists to defaults

// Load settings
async function loadSettings() {
    const savedTheme = localStorage.getItem('stevieTheme');
    if (savedTheme) {
        currentThemeIndex = parseInt(savedTheme, 10);
        applyTheme();
    }

    const savedVersion = localStorage.getItem('stevieConfigVersion');
    const savedPlaylist = localStorage.getItem('steviePlaylist');

    // Only load from LocalStorage if the version matches
    if (savedPlaylist && savedVersion === CONFIG_VERSION) {
        console.log("Loading playlist from LocalStorage");
        playlist = JSON.parse(savedPlaylist);
    } else {
        console.log("Config version mismatch or no save found. Loading defaults.");
        await loadPlaylistFromJson();
        // We don't automatically save to LS here, so we don't overwrite user's potential intent 
        // until they explicitly save. But we do update the version.
        localStorage.setItem('stevieConfigVersion', CONFIG_VERSION);
    }
}

async function loadPlaylistFromJson() {
    console.log("Loading default playlist from JSON");
    try {
        // Add timestamp to prevent caching
        const response = await fetch('playlist.json?t=' + Date.now());
        const data = await response.json();
        // Extract IDs from the JSON URLs immediately to match our format
        playlist = data.map(url => {
            const id = extractVideoID(url);
            return id ? id : url;
        });
    } catch (error) {
        console.error("Failed to load playlist.json", error);
        // Fallback if JSON fails
        playlist = []; 
    }
}

// Initialize
loadSettings();

// --- YouTube API Setup ---
// Load the IFrame Player API code asynchronously.
if (!document.querySelector('script[src*="iframe_api"]')) {
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

function onYouTubeIframeAPIReady() {
    console.log("YouTube API Ready");
    // We don't create the player here anymore. We create it on demand.
}

function onPlayerReady(event) {
    console.log("YouTube Player Ready");
    event.target.setVolume(100);
    // event.target.playVideo(); // Autoplay handled by playerVars
    updateStatus("Playing YouTube...");
}

function onPlayerError(event) {
    console.error("YouTube Player Error:", event.data);
    consecutiveErrors++;
    if (consecutiveErrors >= 3) {
        updateStatus("Too many errors. Stopping playback.");
        stopAll();
        consecutiveErrors = 0;
        return;
    }
    updateStatus("Video Error. Skipping...");
    // Give user time to see the error or try to click play
    setTimeout(playNextSong, 2000);
}

function onPlayerStateChange(event) {
    const visualizer = document.querySelector('.visualizer');
    const playerWrapper = document.getElementById('player-wrapper');
    
    if (event.data === YT.PlayerState.PLAYING) {
        consecutiveErrors = 0; // Reset error count
        visualizer.classList.remove('active');
        playerWrapper.classList.add('active');
        document.body.classList.add('is-playing'); // Start BG animation
        updateStatus("Playing YouTube...");
        isPlayingState = true;
        isLoadingState = false;
    } else if (event.data === YT.PlayerState.PAUSED) {
        document.body.classList.remove('is-playing'); // Stop BG animation
        updateStatus("Paused");
        isPlayingState = false;
    } else if (event.data === YT.PlayerState.ENDED) {
        document.body.classList.remove('is-playing'); // Stop BG animation
        updateStatus("Ended");
        isPlayingState = false;
        playNextSong(); // Auto-play next
    }
}

// --- HTML5 Audio Setup ---
audioPlayer.addEventListener('play', () => {
    consecutiveErrors = 0; // Reset error count
    document.querySelector('.visualizer').classList.add('active');
    document.querySelector('.visualizer').classList.add('playing');
    document.getElementById('player-wrapper').classList.remove('active');
    document.body.classList.add('is-playing'); // Start BG animation
    updateStatus("Playing Audio File...");
    isPlayingState = true;
    isLoadingState = false;
});

audioPlayer.addEventListener('pause', () => {
    document.querySelector('.visualizer').classList.remove('playing');
    document.body.classList.remove('is-playing'); // Stop BG animation
    updateStatus("Paused");
    isPlayingState = false;
});

audioPlayer.addEventListener('ended', () => {
    document.querySelector('.visualizer').classList.remove('playing');
    document.body.classList.remove('is-playing'); // Stop BG animation
    updateStatus("Ended");
    isPlayingState = false;
    playNextSong(); // Auto-play next
});

audioPlayer.addEventListener('error', (e) => {
    console.error("Audio Error", e);
    consecutiveErrors++;
    if (consecutiveErrors >= 3) {
        updateStatus("Too many errors (check links). Stopping.");
        stopAll();
        consecutiveErrors = 0;
        return;
    }
    updateStatus("Error playing audio file. Skipping...");
    setTimeout(playNextSong, 2000);
});


// --- Main Logic ---

function updateStatus(text) {
    const el = document.getElementById('status-text');
    if (el) el.textContent = "Status: " + text;
}

function stopAll() {
    // Stop YouTube
    if (player && player.destroy) {
        try {
            player.destroy();
        } catch(e) { console.error(e); }
        player = null;
    }
    
    // Reset player wrapper (clears Spotify iframe or old YT div)
    const wrapper = document.getElementById('player-wrapper');
    wrapper.innerHTML = '';
    
    // Re-create the placeholder div for YouTube
    const div = document.createElement('div');
    div.id = 'player';
    wrapper.appendChild(div);
    
    // Re-add overlay
    const overlay = document.createElement('div');
    overlay.id = 'player-overlay';
    wrapper.appendChild(overlay);

    // Stop Audio
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    
    document.querySelector('.visualizer').classList.remove('playing');
    document.querySelector('.visualizer').classList.remove('active');
    document.getElementById('player-wrapper').classList.remove('active');
    document.body.classList.remove('is-playing'); // Stop BG animation
    
    isPlayingState = false;
    isLoadingState = false;
}

function playNextSong() {
    if (playlist.length === 0) {
        alert("Playlist is empty! Add some songs in Edit mode.");
        return;
    }
    let nextIndex = currentIndex + 1;
    if (nextIndex >= playlist.length) {
        nextIndex = 0; // Loop back to start
    }
    playSongAtIndex(nextIndex);
}

function playPreviousSong() {
    if (playlist.length === 0) return;
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
        prevIndex = playlist.length - 1; // Loop to end
    }
    playSongAtIndex(prevIndex);
}

function playSongAtIndex(index) {
    stopAll();
    currentIndex = index;
    currentTrack = playlist[currentIndex];
    console.log("Playing:", currentTrack);
    
    isLoadingState = true; // Mark as loading

    // Determine Type
    if (isYouTubeID(currentTrack)) {
        currentType = 'youtube';
        
        // Show player immediately
        document.querySelector('.visualizer').classList.remove('active');
        document.getElementById('player-wrapper').classList.add('active');

        // Create new YouTube Player instance
        if (window.YT && window.YT.Player) {
            player = new YT.Player('player', {
                height: '100%',
                width: '100%',
                videoId: currentTrack,
                playerVars: {
                    'autoplay': 1,
                    'controls': 0,
                    'rel': 0,
                    'fs': 0,
                    'modestbranding': 1,
                    'disablekb': 1,
                    'origin': window.location.origin,
                    'enablejsapi': 1
                },
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange,
                    'onError': onPlayerError
                }
            });
        } else {
            console.warn("YouTube API not ready yet. Retrying in 1s...");
            setTimeout(() => {
                // Retry same song
                playSongAtIndex(index);
            }, 1000);
        }

    } else if (isSpotifyUrl(currentTrack)) {
        currentType = 'spotify';
        
        // Show player wrapper
        document.querySelector('.visualizer').classList.remove('active');
        const playerWrapper = document.getElementById('player-wrapper');
        playerWrapper.classList.add('active');
        
        // Create Spotify Iframe
        const embedUrl = getSpotifyEmbedUrl(currentTrack);
        // We replace the innerHTML, removing the #player div and #player-overlay
        // This is fine because stopAll() restores them.
        playerWrapper.innerHTML = `<iframe style="border-radius:12px" src="${embedUrl}" width="100%" height="100%" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
        
        updateStatus("Playing Spotify (Auto-play limited)");
        isLoadingState = false;
        isPlayingState = true; // Assume playing for state logic
        
    } else if (isSoundCloudUrl(currentTrack)) {
        currentType = 'soundcloud';
        console.log("Detected SoundCloud URL");
        
        // Show player wrapper
        document.querySelector('.visualizer').classList.remove('active');
        const playerWrapper = document.getElementById('player-wrapper');
        playerWrapper.classList.add('active');
        
        // SoundCloud Embed
        // Use visual=true for a better look, but ensure it fits
        const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(currentTrack)}&color=%23ff5500&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;
        
        playerWrapper.innerHTML = `<iframe width="100%" height="100%" scrolling="no" frameborder="no" allow="autoplay" src="${embedUrl}"></iframe>`;
        
        updateStatus("Playing SoundCloud...");
        isLoadingState = false;
        isPlayingState = true;

    } else {
        // Assume Audio URL
        currentType = 'audio';
        console.log("Assuming Audio URL");
        // Process URL (handle Google Drive links)
        const audioSrc = processAudioUrl(currentTrack);
        audioPlayer.src = audioSrc;
        
        if (localFileNames[currentTrack]) {
            updateStatus(`Playing: ${localFileNames[currentTrack]}`);
        } else {
            updateStatus("Playing Audio File...");
        }

        audioPlayer.play().catch(e => {
            console.error("Play failed", e);
            updateStatus("Click to enable audio");
            isLoadingState = false; // Reset if failed
        });
    }
}

function processAudioUrl(url) {
    // Check for Google Drive links
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
        // Try to find ID in /file/d/ID
        let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://drive.google.com/uc?export=download&id=${match[1]}`;
        }
        // Try to find ID in id=ID
        match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            return `https://drive.google.com/uc?export=download&id=${match[1]}`;
        }
    }
    return url;
}

function isYouTubeID(str) {
    // Simple check: if it has no dots and is around 11 chars, it's likely an ID.
    // Or if it matches the regex.
    // If it's a full URL, we extract ID.
    // But our playlist array might contain mixed IDs and URLs.
    // Let's assume if it starts with http, it's a URL (unless it's a blob: URL).
    if (str.startsWith('http') || str.startsWith('blob:')) {
        return false; 
    }
    return true;
}

function extractVideoID(url) {
    // Regex to extract ID from various YouTube URL formats (including music.youtube.com)
    // Updated to handle more edge cases
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?)|(music.youtube.com\/watch\?))\??v?=?([^#&?]*).*/;
    var match = url.match(regExp);
    // match[8] should be the ID if using the updated regex group count
    // Let's use a simpler, more robust regex for ID extraction
    const idMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return (idMatch && idMatch[1]) ? idMatch[1] : false;
}

function isSpotifyUrl(url) {
    return url.includes('spotify.com');
}

function isSoundCloudUrl(url) {
    return url.includes('soundcloud.com') || url.includes('on.soundcloud.com');
}

function getSpotifyEmbedUrl(url) {
    // Convert https://open.spotify.com/track/ID to https://open.spotify.com/embed/track/ID
    // Also handles playlist, album, artist, episode, show
    if (url.includes('/embed/')) return url; // Already embed
    
    const parts = url.split('spotify.com/');
    if (parts.length > 1) {
        // Remove query parameters if any, but keep the path
        let path = parts[1].split('?')[0];
        return `https://open.spotify.com/embed/${path}`;
    }
    return url;
}

function toggleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    applyTheme();
    localStorage.setItem('stevieTheme', currentThemeIndex);
}

function applyTheme() {
    // Remove all theme classes (filter out empty strings)
    const activeThemes = themes.filter(t => t !== '');
    document.body.classList.remove(...activeThemes);
    
    // Add current theme class (if not empty string)
    if (themes[currentThemeIndex]) {
        document.body.classList.add(themes[currentThemeIndex]);
    }
}

// --- Sound Effect ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playClickSound() {
    // Resume context if suspended (browser policy)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // Create a "pop" or "click" sound
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

function triggerButtonVisual(active) {
    const btn = document.getElementById('main-click-area');
    if (active) {
        btn.classList.add('active-state');
    } else {
        btn.classList.remove('active-state');
    }
}

// --- Interaction Logic (Long Press / Short Press) ---
let pressTimer = null;
let longPressTriggered = false;
const LONG_PRESS_DURATION = 3000; // 3 seconds

function handlePressStart() {
    if (pressTimer) return; // Already pressed
    longPressTriggered = false;
    triggerButtonVisual(true); // Keep visual active
    
    pressTimer = setTimeout(() => {
        longPressTriggered = true;
        playClickSound(); // Feedback
        updateStatus("Long Press: Playing Previous...");
        playPreviousSong();
        triggerButtonVisual(false); // Release visual
        pressTimer = null; // Reset timer variable
    }, LONG_PRESS_DURATION);
}

function handlePressEnd() {
    // If timer was running, clear it
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
    
    triggerButtonVisual(false);

    if (!longPressTriggered) {
        // Short Press Logic
        playClickSound();
        handleShortPress();
    }
    // Reset flag
    longPressTriggered = false;
}

function handleShortPress() {
    // Check if playing OR loading
    if (isPlayingState || isLoadingState) {
        // 1st Press: Stop/Pause
        stopAll();
        updateStatus("Stopped (Press again for Next)");
    } else {
        // 2nd Press (or from stopped): Play Next
        playNextSong();
    }
}

// Event Listeners

// Spacebar
document.addEventListener('keydown', function(event) {
    if (event.code === 'Space') {
        if (document.getElementById('edit-modal').classList.contains('hidden')) {
            event.preventDefault();
            if (!event.repeat) { // Ignore auto-repeat
                handlePressStart();
            }
        }
    }
});

document.addEventListener('keyup', function(event) {
    if (event.code === 'Space') {
        if (document.getElementById('edit-modal').classList.contains('hidden')) {
            event.preventDefault();
            handlePressEnd();
        }
    }
});

// Big Button
const mainBtn = document.getElementById('main-click-area');

mainBtn.addEventListener('mousedown', handlePressStart);
mainBtn.addEventListener('mouseup', handlePressEnd);
mainBtn.addEventListener('mouseleave', () => {
    // If mouse leaves, cancel everything
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
        triggerButtonVisual(false);
        longPressTriggered = false;
    }
});

mainBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent mouse emulation
    handlePressStart();
});
mainBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    handlePressEnd();
});

// Theme Button
document.getElementById('theme-btn').addEventListener('click', function() {
    toggleTheme();
});

// Add MP3 Button (Inside Modal)
const mp3Upload = document.getElementById('mp3-upload');
document.getElementById('modal-add-mp3-btn').addEventListener('click', function() {
    mp3Upload.click();
});

// Temporary storage for new files before saving
let tempLocalFiles = [];

mp3Upload.addEventListener('change', function(event) {
    const files = event.target.files;
    const listEl = document.getElementById('local-file-list');
    
    if (files.length > 0) {
        // Clear "No local files" message if it exists
        if (listEl.querySelector('em')) {
            listEl.innerHTML = '';
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const objectURL = URL.createObjectURL(file);
            tempLocalFiles.push(objectURL);
            localFileNames[objectURL] = file.name;
            
            // Add to UI list
            const li = document.createElement('div');
            li.textContent = `🎵 ${file.name}`;
            li.style.padding = '2px 0';
            listEl.appendChild(li);
        }
    }
    // Clear input
    mp3Upload.value = '';
});

// Edit Button
const editModal = document.getElementById('edit-modal');
const linkSlotsContainer = document.getElementById('link-slots-container');

function createLinkSlot(value = '') {
    const div = document.createElement('div');
    div.className = 'link-slot';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'link-input';
    input.placeholder = 'https://...';
    input.value = value;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-link-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove Link';
    removeBtn.onclick = function() {
        div.remove();
    };
    
    div.appendChild(input);
    div.appendChild(removeBtn);
    linkSlotsContainer.appendChild(div);
}

document.getElementById('add-link-btn').addEventListener('click', function() {
    createLinkSlot();
});

document.getElementById('edit-btn').addEventListener('click', function() {
    // Clear existing slots
    linkSlotsContainer.innerHTML = '';

    // Populate slots with URLs only
    const urls = playlist.filter(item => !item.startsWith('blob:')).map(item => {
        if (isYouTubeID(item)) {
            return `https://www.youtube.com/watch?v=${item}`;
        }
        return item;
    });
    
    urls.forEach(url => createLinkSlot(url));
    
    // Always add one empty slot at the end for convenience
    if (urls.length === 0) {
        createLinkSlot();
    }
    
    // Populate local file list
    const listEl = document.getElementById('local-file-list');
    listEl.innerHTML = '';
    const blobs = playlist.filter(item => item.startsWith('blob:'));
    
    if (blobs.length === 0) {
        listEl.innerHTML = '<em style="color: #888;">No local files added yet.</em>';
    } else {
        blobs.forEach(blobUrl => {
            const li = document.createElement('div');
            const name = localFileNames[blobUrl] || "Local File";
            li.textContent = `🎵 ${name}`;
            li.style.padding = '2px 0';
            listEl.appendChild(li);
        });
    }
    
    // Clear temp files on open
    tempLocalFiles = [];
    
    editModal.classList.remove('hidden');
});

// Close Modal
document.getElementById('close-modal').addEventListener('click', function() {
    editModal.classList.add('hidden');
});

// Save Playlist
document.getElementById('save-playlist-btn').addEventListener('click', function() {
    const newPlaylist = [];
    
    // Process Link Slots
    const inputs = document.querySelectorAll('.link-input');
    inputs.forEach(input => {
        const trimmed = input.value.trim();
        if (!trimmed) return;

        // Check if it's a YouTube URL
        const ytId = extractVideoID(trimmed);
        if (ytId) {
            newPlaylist.push(ytId);
        } else {
            // Allow Spotify and other links
            newPlaylist.push(trimmed);
        }
    });

    // Add existing blobs (that were already in playlist)
    const existingBlobs = playlist.filter(item => item.startsWith('blob:'));
    newPlaylist.push(...existingBlobs);
    
    // Add NEW temp blobs
    newPlaylist.push(...tempLocalFiles);

    if (newPlaylist.length > 0) {
        playlist = newPlaylist;
        
        // Save only text items
        const textItems = playlist.filter(item => !item.startsWith('blob:'));
        localStorage.setItem('steviePlaylist', JSON.stringify(textItems));
        localStorage.setItem('stevieConfigVersion', CONFIG_VERSION); // Update version on save
        
        alert(`Playlist updated! Total songs: ${playlist.length}`);
        editModal.classList.add('hidden');
        
        // Reset index to start? Or keep playing?
        // If we changed the playlist, maybe reset index to 0 to ensure we play valid songs.
        currentIndex = -1; 
        
    } else {
        alert('Playlist is empty.');
    }
});

// Reset Playlist
document.getElementById('reset-playlist-btn').addEventListener('click', function() {
    if(confirm("Reset playlist to defaults from playlist.json? This will clear your custom changes.")) {
        localStorage.removeItem('steviePlaylist');
        loadPlaylistFromJson().then(() => {
            alert("Playlist reset to defaults!");
            // Refresh slots by re-clicking edit button logic (simulated)
            // We need to close and reopen or just refresh the view.
            // Simplest is to close modal.
            editModal.classList.add('hidden');
            currentIndex = -1; // Reset playback index
        });
    }
});