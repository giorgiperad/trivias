class AudioSystem {
    constructor() {
        this.settings = {
            musicEnabled: true,
            soundEnabled: true,
            ttsEnabled: true,
            voiceType: 'default',
            currentTrack: 0
        };
        this.currentAudio = null;
        this.audioUnlocked = false;
        
        // Use NarbeVoiceManager for TTS instead of manual voice management
        this.voiceManager = window.NarbeVoiceManager;
        
        // Position name mapping for TTS
        this.positionNames = {
            'P': 'pitcher',
            'C': 'catcher',
            '1B': 'first baseman',
            '2B': 'second baseman',
            '3B': 'third baseman',
            'SS': 'shortstop',
            'LF': 'left fielder',
            'CF': 'center fielder',
            'RF': 'right fielder',
            'BATTER': 'batter'
        };
        
        this.load();
    }

    load() {
        const saved = localStorage.getItem(GAME_CONSTANTS.STORAGE_KEYS.AUDIO);
        if (saved) {
            Object.assign(this.settings, JSON.parse(saved));
        }
        
        // Sync TTS settings with voice manager
        if (this.voiceManager) {
            const voiceSettings = this.voiceManager.getSettings();
            this.settings.ttsEnabled = voiceSettings.ttsEnabled;
        }
    }

    save() {
        localStorage.setItem(GAME_CONSTANTS.STORAGE_KEYS.AUDIO, JSON.stringify(this.settings));
        
        // Update voice manager settings
        if (this.voiceManager) {
            this.voiceManager.updateSettings({
                ttsEnabled: this.settings.ttsEnabled
            });
        }
    }

    unlockAudio() {
        if (this.audioUnlocked) return;
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        source.start(audioContext.currentTime);
        source.stop(audioContext.currentTime + 0.1);
        
        this.audioUnlocked = true;
        
        if (this.settings.musicEnabled) {
            this.playBackgroundMusic();
        }
    }

    speak(text) {
        if (!this.settings.ttsEnabled) return;
        
        // Use NarbeVoiceManager for consistent TTS
        if (this.voiceManager) {
            // Convert position abbreviations to full names
            const processedText = this.convertPositionNames(text);
            this.voiceManager.speakProcessed(processedText);
        } else {
            // Fallback to manual TTS if voice manager not available
            if (!window.speechSynthesis) return;
            
            const processedText = this.convertPositionNames(text);
            const utterance = new SpeechSynthesisUtterance(processedText);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        }
    }

    convertPositionNames(text) {
        let processedText = text;
        
        // Replace position abbreviations with full names
        for (const [abbr, fullName] of Object.entries(this.positionNames)) {
            // Match abbreviation as a whole word (with word boundaries)
            const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
            processedText = processedText.replace(regex, fullName);
        }
        
        return processedText;
    }

    playBackgroundMusic() {
        if (!this.settings.musicEnabled || GAME_CONSTANTS.AUDIO.TRACKS.length === 0) return;
        
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        
        this.currentAudio = new Audio(GAME_CONSTANTS.AUDIO.TRACKS[this.settings.currentTrack]);
        this.currentAudio.loop = true;
        this.currentAudio.volume = 0.15;
        
        const playPromise = this.currentAudio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('Music started successfully');
            }).catch((error) => {
                console.log('Audio play prevented, trying generated music:', error);
                this.playGeneratedMusic();
            });
        }
    }

    playGeneratedMusic() {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        
        oscillator.start();
        
        setTimeout(() => {
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
            oscillator.stop(audioCtx.currentTime + 1);
        }, 30000);
    }

    nextTrack() {
        this.settings.currentTrack = (this.settings.currentTrack + 1) % GAME_CONSTANTS.AUDIO.TRACKS.length;
        this.save(); // Save the new track selection
        this.playBackgroundMusic();
    }

    stopMusic() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
    }

    playSound(type) {
        if (!this.settings.soundEnabled) return;
        
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        switch (type) {
            case 'scan':
                oscillator.frequency.value = 440;
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
                oscillator.start(audioCtx.currentTime);
                oscillator.stop(audioCtx.currentTime + 0.1);
                break;
            case 'select':
                oscillator.frequency.value = 880;
                gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
                oscillator.start(audioCtx.currentTime);
                oscillator.stop(audioCtx.currentTime + 0.15);
                break;
            case 'hit':
                oscillator.frequency.value = 200;
                gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                oscillator.start(audioCtx.currentTime);
                oscillator.stop(audioCtx.currentTime + 0.3);
                break;
            case 'cheer':
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        const cheer = audioCtx.createOscillator();
                        const cheerGain = audioCtx.createGain();
                        cheer.connect(cheerGain);
                        cheerGain.connect(audioCtx.destination);
                        cheer.frequency.value = 600 + Math.random() * 400;
                        cheerGain.gain.setValueAtTime(0.15, audioCtx.currentTime);
                        cheerGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
                        cheer.start(audioCtx.currentTime);
                        cheer.stop(audioCtx.currentTime + 0.2);
                    }, i * 100);
                }
                break;
        }
    }
}