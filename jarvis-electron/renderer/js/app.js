/**
 * App — wires orb, voice, and response engine together.
 */
(async function() {
  const canvas = document.getElementById('orbCanvas');
  const micBtn = document.getElementById('micToggle');
  const stateIndicator = document.getElementById('stateIndicator');

  const orb = new Orb(canvas);
  const voice = new VoiceEngine();
  const responses = new ResponseEngine();

  // Load persisted memory
  await responses.loadMemory();

  // State change handler — updates orb visual state and indicator
  voice.onStateChange = (state) => {
    orb.setState(state);
    stateIndicator.textContent = state.toUpperCase();
  };

  // Voice result handler — process input, generate response, speak it
  voice.onResult = (transcript) => {
    orb.setState('processing');
    stateIndicator.textContent = 'PROCESSING';

    // Small delay to show processing state
    setTimeout(() => {
      const response = responses.process(transcript);
      voice.speak(
        response,
        () => {
          // While speaking, pulse the orb loosely to speech rhythm
          let pulseInterval = setInterval(() => {
            if (!voice.isSpeaking) {
              clearInterval(pulseInterval);
              orb.setSpeakingAmplitude(0);
              return;
            }
            // Simulate speech amplitude with gentle randomized variation
            orb.setSpeakingAmplitude(0.3 + Math.random() * 0.7);
          }, 120);
        },
        () => {
          orb.setSpeakingAmplitude(0);
        }
      );
    }, 300);
  };

  // Mic toggle
  micBtn.addEventListener('click', () => {
    const muted = voice.toggleMute();
    micBtn.classList.toggle('muted', muted);
    micBtn.title = muted ? 'Unmute microphone' : 'Mute microphone';
  });

  // Greeting on launch
  const greeting = responses.getGreeting();
  voice.speak(greeting, null, () => {
    voice.startListening();
  });

  // Handle visibility changes to restart recognition if needed
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !voice.isMuted) {
      voice.startListening();
    }
  });
})();
