/**
 * Voice engine — handles speech recognition (input) and synthesis (output).
 *
 * Uses Web Speech API which is available in Electron's Chromium.
 * SpeechRecognition requires internet (uses Google's service under the hood).
 * SpeechSynthesis works offline with system voices.
 */
class VoiceEngine {
  constructor() {
    this.isListening = false;
    this.isMuted = false;
    this.isSpeaking = false;
    this.recognition = null;
    this.synth = window.speechSynthesis;
    this.onResult = null;
    this.onStateChange = null;
    this.wakePhrase = 'hey jarvis';
    this.useWakePhrase = false;
    this.awake = true; // if no wake phrase, always awake
    this.awakeTimeout = null;
    this._selectedVoice = null;

    this._initRecognition();
    this._pickVoice();
  }

  _initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not available in this environment');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;

      const transcript = last[0].transcript.trim().toLowerCase();
      if (!transcript) return;

      // Wake phrase handling
      if (this.useWakePhrase && !this.awake) {
        if (transcript.includes(this.wakePhrase)) {
          this.awake = true;
          const afterWake = transcript.split(this.wakePhrase).pop().trim();
          if (afterWake && this.onResult) {
            this._emitState('listening');
            this.onResult(afterWake);
          } else {
            this._emitState('listening');
            // Acknowledged wake, waiting for command
          }
          this._resetAwakeTimer();
        }
        return;
      }

      if (this.onResult) {
        this._emitState('processing');
        this.onResult(transcript);
      }

      if (this.useWakePhrase) {
        this._resetAwakeTimer();
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        // Mic permission denied — stop trying, notify user via state
        this.isListening = false;
        this._emitState('idle');
        return;
      }
      if (event.error === 'network') {
        setTimeout(() => this.startListening(), 2000);
      }
    };

    this.recognition.onend = () => {
      // Auto-restart unless muted
      if (!this.isMuted && this.isListening) {
        try {
          this.recognition.start();
        } catch (e) {
          // Already started, ignore
        }
      }
    };
  }

  _pickVoice() {
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      if (!voices.length) return;

      // Prefer natural/neural voices, English, male-sounding names
      const preferred = [
        'Microsoft David',
        'Microsoft Mark',
        'Google UK English Male',
        'Daniel',
        'James',
        'en-GB'
      ];

      for (const pref of preferred) {
        const found = voices.find(v =>
          v.name.includes(pref) || v.lang.includes(pref)
        );
        if (found) {
          this._selectedVoice = found;
          return;
        }
      }

      // Fallback to first English voice
      this._selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  _resetAwakeTimer() {
    clearTimeout(this.awakeTimeout);
    // Go back to sleep after 30 seconds of no interaction
    this.awakeTimeout = setTimeout(() => {
      this.awake = false;
      this._emitState('idle');
    }, 30000);
  }

  _emitState(state) {
    if (this.onStateChange) this.onStateChange(state);
  }

  startListening() {
    if (!this.recognition) return;
    this.isListening = true;
    this.isMuted = false;
    try {
      this.recognition.start();
      if (!this.useWakePhrase) {
        this._emitState('listening');
      }
    } catch (e) {
      // Already started
    }
  }

  stopListening() {
    if (!this.recognition) return;
    this.isListening = false;
    try {
      this.recognition.stop();
    } catch (e) {}
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopListening();
      this._emitState('idle');
    } else {
      this.startListening();
    }
    return this.isMuted;
  }

  speak(text, onStart, onEnd) {
    // Cancel any current speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (this._selectedVoice) {
      utterance.voice = this._selectedVoice;
    }
    utterance.rate = 0.9;
    utterance.pitch = 0.95;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this._emitState('speaking');
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this._emitState(this.isMuted ? 'idle' : 'listening');
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.error('Speech synthesis error:', e);
      this.isSpeaking = false;
      this._emitState(this.isMuted ? 'idle' : 'listening');
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }
}
