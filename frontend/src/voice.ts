/**
 * Voice input and audio output for JARVIS.
 * Compatible with Chrome, Safari, Firefox, and mobile browsers.
 */

// ---------------------------------------------------------------------------
// Speech Recognition
// ---------------------------------------------------------------------------

export interface VoiceInput {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
}

declare const webkitSpeechRecognition: any;

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

export function createVoiceInput(
  onTranscript: (text: string) => void,
  onError: (msg: string) => void
): VoiceInput {
  // HTTPS check for non-localhost (phones need HTTPS for mic)
  const isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (!isLocalhost && location.protocol !== "https:") {
    onError("Open the HTTPS link (ngrok) on your phone — HTTP blocks the microphone.");
    return { start() {}, stop() {}, pause() {}, resume() {} };
  }

  const SR = (window as any).SpeechRecognition
    || (typeof webkitSpeechRecognition !== "undefined" ? webkitSpeechRecognition : null);

  if (!SR) {
    onError("Speech recognition not supported in this browser. Try Chrome or Safari.");
    return { start() {}, stop() {}, pause() {}, resume() {} };
  }

  const recognition = new SR();
  // Safari doesn't support continuous well — set to false and restart manually
  recognition.continuous = !isSafari && !isIOS;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.maxAlternatives = 1;

  let shouldListen = false;
  let paused = false;
  let restarting = false;

  recognition.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        const text = event.results[i][0].transcript.trim();
        if (text) onTranscript(text);
      }
    }
  };

  recognition.onend = () => {
    restarting = false;
    if (shouldListen && !paused) {
      // Always restart — Safari needs this even more than Chrome
      restarting = true;
      setTimeout(() => {
        if (shouldListen && !paused) {
          try { recognition.start(); } catch { restarting = false; }
        }
      }, isIOS ? 300 : 100);
    }
  };

  recognition.onerror = (event: any) => {
    if (event.error === "not-allowed") {
      onError("Microphone blocked. Go to your browser Settings and allow microphone for this site.");
      shouldListen = false;
    } else if (event.error === "no-speech") {
      // Normal on Safari — just let onend restart it
    } else if (event.error === "aborted") {
      // Expected when pausing
    } else if (event.error === "network") {
      onError("Network error. Check your connection.");
    } else {
      console.warn("[voice] error:", event.error);
    }
  };

  return {
    start() {
      shouldListen = true;
      paused = false;
      if (!restarting) {
        try { recognition.start(); } catch { /* already started */ }
      }
    },
    stop() {
      shouldListen = false;
      paused = false;
      restarting = false;
      try { recognition.stop(); } catch { /* already stopped */ }
    },
    pause() {
      paused = true;
      try { recognition.stop(); } catch { /* already stopped */ }
    },
    resume() {
      paused = false;
      if (shouldListen && !restarting) {
        try { recognition.start(); } catch { /* already started */ }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Audio Player — Safari/iOS compatible
// ---------------------------------------------------------------------------

export interface AudioPlayer {
  enqueue(base64: string): Promise<void>;
  stop(): void;
  getAnalyser(): AnalyserNode;
  onFinished(cb: () => void): void;
}

export function createAudioPlayer(): AudioPlayer {
  // Safari needs webkitAudioContext fallback
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  analyser.connect(audioCtx.destination);

  const queue: AudioBuffer[] = [];
  let isPlaying = false;
  let currentSource: AudioBufferSourceNode | null = null;
  let finishedCallback: (() => void) | null = null;

  function playNext() {
    if (queue.length === 0) {
      isPlaying = false;
      currentSource = null;
      finishedCallback?.();
      return;
    }

    isPlaying = true;
    const buffer = queue.shift()!;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);
    currentSource = source;
    source.onended = () => {
      if (currentSource === source) playNext();
    };
    source.start(0);
  }

  return {
    async enqueue(base64: string) {
      // Must resume AudioContext after user gesture (required by all browsers)
      if (audioCtx.state === "suspended") {
        try { await audioCtx.resume(); } catch { /* ignore */ }
      }

      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        // Use promise form for Safari compatibility
        const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
          audioCtx.decodeAudioData(bytes.buffer.slice(0), resolve, reject);
        });

        queue.push(audioBuffer);
        if (!isPlaying) playNext();
      } catch (err) {
        console.error("[audio] decode error:", err);
        if (!isPlaying && queue.length > 0) playNext();
      }
    },

    stop() {
      queue.length = 0;
      if (currentSource) {
        try { currentSource.stop(); } catch { /* already stopped */ }
        currentSource = null;
      }
      isPlaying = false;
    },

    getAnalyser() { return analyser; },
    onFinished(cb: () => void) { finishedCallback = cb; },
  };
}
