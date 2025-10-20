// TTS functionality using unified voice manager (simplified approach like keyboard app)
function speak(text) {
    if (!text || text.trim() === '') return;
    
    console.log('🔊 Speaking:', text);
    
    // Use the unified voice manager's speakProcessed function for better pronunciation
    if (window.NarbeVoiceManager && window.NarbeVoiceManager.speakProcessed) {
        window.NarbeVoiceManager.speakProcessed(text);
        console.log('✅ Used NarbeVoiceManager for TTS');
    } else {
        console.warn('NarbeVoiceManager not available, using fallback');
        // Fallback to direct speech synthesis only if shared manager is not available
        speakFallback(text);
    }
}

function speakFallback(text) {
    try {
        if (!('speechSynthesis' in window)) {
            console.warn('❌ No speech synthesis support available');
            return;
        }
        
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
        console.log('✅ Used fallback TTS');
    } catch (error) {
        console.error('Fallback TTS error:', error);
    }
}

// Simple speech manager that mimics the old interface but uses the shared voice manager directly
class SpeechManager {
    speak(text) {
        speak(text);
    }
    
    queueSpeak(text) {
        speak(text);
    }
    
    stop() {
        try {
            if (window.NarbeVoiceManager) {
                window.NarbeVoiceManager.cancel();
            }
            // Also stop fallback
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
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

// Global speech manager instance
console.log('🎤 Creating global speechManager...');
window.speechManager = new SpeechManager();

// Test TTS on load - wait a moment for everything to initialize
setTimeout(() => {
    if (window.speechManager) {
        console.log('🧪 Testing TTS...');
        window.speechManager.speak('speech ready');
    }
}, 500);