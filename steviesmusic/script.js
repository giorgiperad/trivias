// Default playlist (can be overwritten by user)
// Supports YouTube IDs or direct Audio URLs (mp3, wav, ogg)
let playlist = [
    'dQw4w9WgXcQ', // Rick Roll (Example)
    'jNQXAC9IVRw', // Me at the zoo (Example)
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' // Test MP3
];

let player = null; // YouTube Player Instance
let audioPlayer = new Audio(); // HTML5 Audio Player
let currentTrack = '';
let currentType = 'none'; // 'youtube' or 'audio'
let currentIndex = -1;
let consecutiveErrors = 0; // Track consecutive errors to prevent infinite loops

// Themes
const themes = ['', 'theme-sunset', 'theme-dark', 'theme-forest', 'theme-candy'];
let currentThemeIndex = 0;

// Load settings from LocalStorage
const savedPlaylist = localStorage.getItem('steviePlaylist');
if (savedPlaylist) {
    playlist = JSON.parse(savedPlaylist);
}

const savedTheme = localStorage.getItem('stevieTheme');
if (savedTheme) {
    currentThemeIndex = parseInt(savedTheme, 10);
    applyTheme();
}

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
    } else if (event.data === YT.PlayerState.PAUSED) {
        document.body.classList.remove('is-playing'); // Stop BG animation
        updateStatus("Paused");
    } else if (event.data === YT.PlayerState.ENDED) {
        document.body.classList.remove('is-playing'); // Stop BG animation
        updateStatus("Ended");
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
});

audioPlayer.addEventListener('pause', () => {
    document.querySelector('.visualizer').classList.remove('playing');
    document.body.classList.remove('is-playing'); // Stop BG animation
    updateStatus("Paused");
});

audioPlayer.addEventListener('ended', () => {
    document.querySelector('.visualizer').classList.remove('playing');
    document.body.classList.remove('is-playing'); // Stop BG animation
    updateStatus("Ended");
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
    
    // Re-create the placeholder div for next time
    const wrapper = document.getElementById('player-wrapper');
    if (!document.getElementById('player')) {
        const div = document.createElement('div');
        div.id = 'player';
        wrapper.insertBefore(div, wrapper.firstChild);
    }

    // Stop Audio
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    
    document.querySelector('.visualizer').classList.remove('playing');
    document.querySelector('.visualizer').classList.remove('active');
    document.getElementById('player-wrapper').classList.remove('active');
    document.body.classList.remove('is-playing'); // Stop BG animation
}

function playNextSong() {
    if (playlist.length === 0) {
        alert("Playlist is empty! Add some songs in Edit mode.");
        return;
    }

    stopAll();

    // Sequential Playback
    currentIndex++;
    if (currentIndex >= playlist.length) {
        currentIndex = 0; // Loop back to start
    }

    currentTrack = playlist[currentIndex];
    console.log("Playing:", currentTrack);

    // Determine Type
    if (isYouTubeID(currentTrack)) {
        currentType = 'youtube';
        
        // Show player immediately
        document.querySelector('.visualizer').classList.remove('active');
        document.getElementById('player-wrapper').classList.add('active');

        // Create new YouTube Player instance
        // This is the "flawless" method from bennyshub: destroy and recreate
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
                    'origin': window.location.origin, // Critical for API security
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
                currentIndex--; // Retry same song
                playNextSong();
            }, 1000);
        }

    } else {
        // Assume Audio URL
        currentType = 'audio';
        // Process URL (handle Google Drive links)
        const audioSrc = processAudioUrl(currentTrack);
        audioPlayer.src = audioSrc;
        
        audioPlayer.play().catch(e => {
            console.error("Play failed", e);
            updateStatus("Click to enable audio");
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

function triggerButtonVisual() {
    const btn = document.getElementById('main-click-area');
    btn.classList.add('active-state');
    setTimeout(() => {
        btn.classList.remove('active-state');
    }, 100);
}

// Event Listeners

// Spacebar to play/shuffle
document.addEventListener('keydown', function(event) {
    if (event.code === 'Space') {
        event.preventDefault();
        if (document.getElementById('edit-modal').classList.contains('hidden')) {
            triggerButtonVisual();
            playClickSound();
            playNextSong();
        }
    }
});

// Big Button Click (Now the Main Area)
document.getElementById('main-click-area').addEventListener('click', function() {
    playClickSound();
    playNextSong();
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
const playlistInput = document.getElementById('playlist-input');

document.getElementById('edit-btn').addEventListener('click', function() {
    // Populate textarea with URLs only
    const urls = playlist.filter(item => !item.startsWith('blob:')).map(item => {
        if (isYouTubeID(item)) {
            return `https://www.youtube.com/watch?v=${item}`;
        }
        return item;
    });
    playlistInput.value = urls.join('\n');
    
    // Populate local file list
    const listEl = document.getElementById('local-file-list');
    listEl.innerHTML = '';
    const blobs = playlist.filter(item => item.startsWith('blob:'));
    
    if (blobs.length === 0 && tempLocalFiles.length === 0) {
        listEl.innerHTML = '<em style="color: #888;">No local files added yet.</em>';
    } else {
        // Show existing blobs (we don't have filenames for existing blobs easily unless we stored them, 
        // but for now let's just show "Local File")
        blobs.forEach((blob, index) => {
            const li = document.createElement('div');
            li.textContent = `🎵 Local File ${index + 1}`;
            li.style.padding = '2px 0';
            listEl.appendChild(li);
        });
    }
    
    // Clear temp files on open? No, maybe keep them if user closed without saving? 
    // Let's clear temp files to avoid confusion.
    tempLocalFiles = [];
    
    editModal.classList.remove('hidden');
});

// Close Modal
document.getElementById('close-modal').addEventListener('click', function() {
    editModal.classList.add('hidden');
});

// Save Playlist
document.getElementById('save-playlist-btn').addEventListener('click', function() {
    const rawText = playlistInput.value;
    const lines = rawText.split('\n');
    const newPlaylist = [];

    // Process Text Area
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Check if it's a YouTube URL
        const ytId = extractVideoID(trimmed);
        if (ytId) {
            newPlaylist.push(ytId);
        } else {
            if (trimmed.includes('spotify.com')) {
                alert("Note: Spotify links are not supported directly.");
            } else {
                newPlaylist.push(trimmed);
            }
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
        
        alert(`Playlist updated! Total songs: ${playlist.length}`);
        editModal.classList.add('hidden');
        
        // Reset index to start? Or keep playing?
        // If we changed the playlist, maybe reset index to 0 to ensure we play valid songs.
        currentIndex = -1; 
        
    } else {
        alert('Playlist is empty.');
    }
});