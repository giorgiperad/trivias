class AudioManager {
    constructor() {
        this.soundEnabled = true;
        this.musicEnabled = true;
        this.ttsEnabled = true;
        this.voices = [];
        this.selectedVoiceIndex = 0;
        
        // Load Sounds
        this.sounds = {
            'putt': new Audio('sounds/putt.wav'),
            'hole': new Audio('sounds/in-hole.wav'),
            'splash': new Audio('sounds/splash.wav'),
            'click': new Audio('sounds/balls-click.wav')
        };
        
        // Ambient Sound
        this.ambience = new Audio('sounds/ambience.wav');
        this.ambience.loop = true;
        this.ambience.volume = 0.3; // Lower volume for background
        
        // Initialize TTS
        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = () => {
                this.voices = window.speechSynthesis.getVoices();
            };
        }
        
        // Start ambience if enabled (requires user interaction usually, but we'll try)
        // Note: Browsers block autoplay until interaction. We might need to call this on first click.
        if (this.musicEnabled) {
            // We'll try to play, but it might fail. 
            // Better to hook into a "start" event or just let the first interaction trigger it.
            document.addEventListener('click', () => {
                if (this.musicEnabled && this.ambience.paused) {
                    this.ambience.play().catch(e => {});
                }
            }, { once: true });
        }
    }

    speak(text) {
        if (!this.ttsEnabled || !('speechSynthesis' in window)) return;
        
        // Cancel current speech to avoid queue buildup
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voices.length > 0) {
            utterance.voice = this.voices[this.selectedVoiceIndex];
        }
        window.speechSynthesis.speak(utterance);
    }

    playSound(name) {
        if (!this.soundEnabled) return;
        
        // Play file-based sounds
        if (this.sounds[name]) {
            const sound = this.sounds[name].cloneNode();
            sound.volume = 0.6;
            sound.play().catch(e => console.warn("Audio play failed:", e));
            return;
        }
        
        // Simple Synthesizer for immediate feedback
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            if (name === 'cheer') {
                // Celebration chord
                this.playTone(ctx, 523.25, 0, 0.5); // C5
                this.playTone(ctx, 659.25, 0.1, 0.5); // E5
                this.playTone(ctx, 783.99, 0.2, 0.5); // G5
                this.playTone(ctx, 1046.50, 0.3, 0.8); // C6
            } else if (name === 'bush') {
                // Low pitch sound for bush interaction
                this.playTone(ctx, 120, 0, 0.2); // Low thud
            }
        }
    }

    playTone(ctx, freq, delay, duration) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + delay + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + duration);
        
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
    }

    startChargeSound() {
        if (!this.soundEnabled) return;
        this.lastChargeStep = 0;
    }

    updateChargeSound(percent) {
        if (!this.soundEnabled) return;
        
        // Play a beep every 20% charge
        // Steps: 1 (20%), 2 (40%), 3 (60%), 4 (80%), 5 (100%)
        const step = Math.floor(percent * 5); 
        
        // Only play if we moved to a new step (and ignore step 0 which is < 20%)
        if (step > this.lastChargeStep && step > 0 && step <= 5) {
            this.playChargeBeep(step);
            this.lastChargeStep = step;
        }
    }
    
    playChargeBeep(step) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.audioCtx = this.audioCtx || new AudioContext();
        
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        // Cute rising tones (C Major Pentatonic: C5, D5, E5, G5, C6)
        const freqs = [523.25, 587.33, 659.25, 783.99, 1046.50];
        const freq = freqs[step - 1] || freqs[freqs.length - 1];
        
        osc.type = 'sine'; // Sine wave is softer/cuter
        osc.frequency.value = freq;
        
        const now = this.audioCtx.currentTime;
        gain.gain.setValueAtTime(0.15, now); 
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15); // Short blip
        
        osc.start(now);
        osc.stop(now + 0.15);
    }

    stopChargeSound() {
        this.lastChargeStep = 0;
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        return this.soundEnabled;
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        
        if (this.musicEnabled) {
            this.ambience.play().catch(e => console.warn("Ambience play failed:", e));
        } else {
            this.ambience.pause();
        }
        
        return this.musicEnabled;
    }

    toggleTTS() {
        this.ttsEnabled = !this.ttsEnabled;
        return this.ttsEnabled;
    }

    cycleVoice() {
        if (this.voices.length === 0) return "Default";
        this.selectedVoiceIndex = (this.selectedVoiceIndex + 1) % this.voices.length;
        const voiceName = this.voices[this.selectedVoiceIndex].name;
        this.speak("Voice changed to " + voiceName);
        return voiceName;
    }
    
    getCurrentVoiceName() {
        if (this.voices.length === 0) return "Default";
        return this.voices[this.selectedVoiceIndex].name;
    }
}

const AudioSys = new AudioManager();
