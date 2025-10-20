// Speech compatibility layer for shared voice manager
// This provides the same interface as the old SpeechManager but uses NarbeVoiceManager

class SpeechManager {
    constructor() {
        // Wait for the shared voice manager to be available
        this.ready = false;
        this.init();
    }
    
    async init() {
        // Wait for NarbeVoiceManager to be available
        let attempts = 0;
        while (!window.NarbeVoiceManager && attempts < 100) {
            await new Promise(resolve => setTimeout(resolve, 50));
            attempts++;
        }
        
        if (!window.NarbeVoiceManager) {
            console.error('NarbeVoiceManager not found after waiting');
            return;
        }
        
        // Wait for voices to load
        try {
            await window.NarbeVoiceManager.waitForVoices();
            this.ready = true;
            console.log('✅ SpeechManager compatibility layer initialized with shared voice manager');
        } catch (error) {
            console.error('Error initializing voice manager:', error);
            this.ready = false;
        }
    }
    
    speak(text) {
        if (!text || text.trim() === '') return;
        
        if (!this.ready) {
            console.warn('SpeechManager not ready, attempting to speak anyway');
        }
        
        try {
            if (window.NarbeVoiceManager) {
                // Use the shared voice manager's speakProcessed method for better pronunciation
                window.NarbeVoiceManager.speakProcessed(text.toString());
            } else {
                console.error('NarbeVoiceManager not available for TTS');
            }
        } catch (error) {
            console.error('Error in speak:', error);
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
window.speechManager = new SpeechManager();