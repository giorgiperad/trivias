// Speech compatibility layer for shared voice manager
// This provides the same interface as the old SpeechManager but uses NarbeVoiceManager

class SpeechManager {
    constructor() {
        // Wait for the shared voice manager to be available
        this.ready = false;
        this.fallbackReady = false;
        this.init();
    }
    
    async init() {
        console.log('🎤 Initializing SpeechManager...');
        
        // Initialize fallback speech synthesis immediately
        this.initFallbackTTS();
        
        // Wait for NarbeVoiceManager to be available
        let attempts = 0;
        while (!window.NarbeVoiceManager && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.NarbeVoiceManager) {
            console.warn('NarbeVoiceManager not found, using fallback TTS');
            this.ready = false;
            return;
        }
        
        // Wait for voices to load
        try {
            await window.NarbeVoiceManager.waitForVoices();
            this.ready = true;
            console.log('✅ SpeechManager initialized with shared voice manager');
        } catch (error) {
            console.error('Error initializing voice manager:', error);
            this.ready = false;
        }
    }
    
    initFallbackTTS() {
        if ('speechSynthesis' in window) {
            this.fallbackReady = true;
            console.log('✅ Fallback TTS initialized');
        } else {
            console.warn('❌ No speech synthesis support available');
        }
    }
    
    speak(text) {
        if (!text || text.trim() === '') return;
        
        console.log('🔊 Speaking:', text);
        
        try {
            if (this.ready && window.NarbeVoiceManager) {
                // Use the shared voice manager's speakProcessed method for better pronunciation
                window.NarbeVoiceManager.speakProcessed(text.toString());
                console.log('✅ Used NarbeVoiceManager for TTS');
            } else if (this.fallbackReady) {
                // Fallback to direct speech synthesis
                this.speakFallback(text);
                console.log('✅ Used fallback TTS');
            } else {
                console.error('❌ No TTS available');
            }
        } catch (error) {
            console.error('Error in speak:', error);
            // Try fallback if main method fails
            if (this.fallbackReady) {
                this.speakFallback(text);
            }
        }
    }
    
    speakFallback(text) {
        try {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text.toString());
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            // Try to get a good voice
            const voices = window.speechSynthesis.getVoices();
            const englishVoice = voices.find(voice => 
                voice.lang.startsWith('en-') && voice.name.includes('Google')
            ) || voices.find(voice => voice.lang.startsWith('en-')) || voices[0];
            
            if (englishVoice) {
                utterance.voice = englishVoice;
            }
            
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Fallback TTS error:', error);
        }
    }
    
    queueSpeak(text) {
        // The shared voice manager handles queuing internally
        this.speak(text);
    }
    
    stop() {
        try {
            if (window.NarbeVoiceManager) {
                window.NarbeVoiceManager.cancel();
            }
            // Also stop fallback
            window.speechSynthesis.cancel();
        } catch (error) {
            console.error('Error stopping speech:', error);
        }
    }
    
    toggle() {
        try {
            if (window.NarbeVoiceManager) {
                return window.NarbeVoiceManager.toggleTTS();
            }
        } catch (error) {
            console.error('Error toggling TTS:', error);
        }
        return true;
    }
    
    // Getter to check if TTS is enabled
    get enabled() {
        try {
            if (window.NarbeVoiceManager) {
                const settings = window.NarbeVoiceManager.getSettings();
                return settings.ttsEnabled;
            }
        } catch (error) {
            console.error('Error getting TTS enabled state:', error);
        }
        return true;
    }
    
    // Setter for enabled state
    set enabled(value) {
        try {
            if (window.NarbeVoiceManager) {
                const settings = window.NarbeVoiceManager.getSettings();
                if (settings.ttsEnabled !== value) {
                    window.NarbeVoiceManager.toggleTTS();
                }
            }
        } catch (error) {
            console.error('Error setting TTS enabled state:', error);
        }
    }
}

// Global speech manager instance using the compatibility layer
console.log('🎤 Creating global speechManager...');
window.speechManager = new SpeechManager();

// Test TTS on load
setTimeout(() => {
    if (window.speechManager) {
        console.log('🧪 Testing TTS...');
        window.speechManager.speak('speech ready');
    }
}, 1000);