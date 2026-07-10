/**
 * Response engine — processes user input and generates spoken responses.
 * Phase 1: keyword-based matching with personality.
 */
class ResponseEngine {
  constructor() {
    this.memory = {
      userName: null,
      conversationHistory: [],
      corrections: {},
      firstLaunch: null,
      lastSeen: null
    };
    this._greetingUsed = new Set();
  }

  async loadMemory() {
    if (window.jarvisAPI) {
      const saved = await window.jarvisAPI.loadMemory();
      if (saved) {
        Object.assign(this.memory, saved);
      }
    }
  }

  async saveMemory() {
    this.memory.lastSeen = new Date().toISOString();
    if (window.jarvisAPI) {
      await window.jarvisAPI.saveMemory(this.memory);
    }
  }

  async clearMemory() {
    this.memory = {
      userName: null,
      conversationHistory: [],
      corrections: {},
      firstLaunch: new Date().toISOString(),
      lastSeen: null
    };
    if (window.jarvisAPI) {
      await window.jarvisAPI.clearMemory();
    }
  }

  getGreeting() {
    const hour = new Date().getHours();
    let timeOfDay;
    if (hour < 6) timeOfDay = 'late';
    else if (hour < 12) timeOfDay = 'morning';
    else if (hour < 17) timeOfDay = 'afternoon';
    else if (hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'late';

    const name = this.memory.userName;
    const nameStr = name ? `, ${name}` : '';

    const greetings = {
      morning: [
        `Good morning${nameStr}. Systems are online and ready.`,
        `Morning${nameStr}. I trust you slept well. What can I do for you?`,
        `Good morning${nameStr}. All systems nominal. How shall we begin?`,
        `Ah, good morning${nameStr}. Another day, another opportunity.`,
        `Morning${nameStr}. I've been keeping things in order while you were away.`
      ],
      afternoon: [
        `Good afternoon${nameStr}. How may I assist?`,
        `Afternoon${nameStr}. I'm at your disposal.`,
        `Good afternoon${nameStr}. Ready when you are.`,
        `Hello${nameStr}. Systems are standing by for your instructions.`,
        `Good afternoon${nameStr}. What shall we tackle?`
      ],
      evening: [
        `Good evening${nameStr}. What can I help with tonight?`,
        `Evening${nameStr}. Still some hours left in the day. What do you need?`,
        `Good evening${nameStr}. All systems are running smoothly.`,
        `Hello${nameStr}. Burning the evening oil, are we?`,
        `Evening${nameStr}. I'm here whenever you need me.`
      ],
      late: [
        `You're up late${nameStr}. Nevertheless, I'm at your service.`,
        `Working through the night${nameStr}? I'll keep pace.`,
        `The midnight oil it is${nameStr}. What do you need?`,
        `Hello${nameStr}. Rest is important, but I won't presume to lecture.`,
        `Late hours${nameStr}. I'm fully operational whenever you are.`
      ]
    };

    const pool = greetings[timeOfDay];
    // Pick one that hasn't been used recently
    const available = pool.filter(g => !this._greetingUsed.has(g));
    const pick = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : pool[Math.floor(Math.random() * pool.length)];

    this._greetingUsed.add(pick);
    if (this._greetingUsed.size >= pool.length) {
      this._greetingUsed.clear();
    }

    return pick;
  }

  process(input) {
    const lower = input.toLowerCase().trim();

    // Log to history
    this.memory.conversationHistory.push({
      role: 'user',
      text: input,
      timestamp: new Date().toISOString()
    });

    // Keep history to a reasonable size
    if (this.memory.conversationHistory.length > 200) {
      this.memory.conversationHistory = this.memory.conversationHistory.slice(-100);
    }

    const response = this._matchResponse(lower, input);

    this.memory.conversationHistory.push({
      role: 'jarvis',
      text: response,
      timestamp: new Date().toISOString()
    });

    this.saveMemory();
    return response;
  }

  _matchResponse(lower, original) {
    // Name setting
    if (lower.match(/my name is (.+)/)) {
      const name = original.match(/my name is (.+)/i)[1].trim();
      this.memory.userName = name;
      return `Noted. I'll remember that, ${name}. What else can I do for you?`;
    }

    if (lower.match(/call me (.+)/)) {
      const name = original.match(/call me (.+)/i)[1].trim();
      this.memory.userName = name;
      return `${name} it is. Consider it done.`;
    }

    // Name recall
    if (lower.includes('what is my name') || lower.includes("what's my name") || lower.includes('do you know my name')) {
      if (this.memory.userName) {
        return `Your name is ${this.memory.userName}. Unless you'd prefer I call you something else.`;
      }
      return "I don't believe you've told me your name yet. I'm all ears, though.";
    }

    // Time
    if (lower.includes('what time') || lower.includes('the time') || lower.match(/^time$/)) {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `It's currently ${time}.`;
    }

    // Date
    if (lower.includes('what date') || lower.includes('the date') || lower.includes("today's date") || lower.includes('what day')) {
      const now = new Date();
      const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      return `Today is ${date}.`;
    }

    // Quick math
    if (lower.match(/what(?:'s| is) (\d+[\d\s\+\-\*\/\.\(\)]+)/)) {
      try {
        const expr = lower.match(/what(?:'s| is) ([\d\s\+\-\*\/\.\(\)]+)/)[1].trim();
        const result = this._safeMathEval(expr);
        if (result !== null) {
          return `That would be ${result}.`;
        }
      } catch (e) {}
    }

    if (lower.match(/calculate (.+)/) || lower.match(/compute (.+)/)) {
      try {
        const expr = (lower.match(/calculate (.+)/) || lower.match(/compute (.+)/))[1].trim();
        const result = this._safeMathEval(expr);
        if (result !== null) {
          return `The result is ${result}.`;
        }
      } catch (e) {}
      return "I'm afraid I couldn't parse that calculation. Could you rephrase it?";
    }

    // Conversions
    if (lower.match(/convert (\d+\.?\d*)\s*(celsius|fahrenheit|c|f)\s*to\s*(celsius|fahrenheit|c|f)/i)) {
      const match = lower.match(/convert (\d+\.?\d*)\s*(celsius|fahrenheit|c|f)\s*to\s*(celsius|fahrenheit|c|f)/i);
      const val = parseFloat(match[1]);
      const from = match[2][0].toLowerCase();
      if (from === 'c') {
        const result = (val * 9/5) + 32;
        return `${val} degrees Celsius is ${result.toFixed(1)} degrees Fahrenheit.`;
      } else {
        const result = (val - 32) * 5/9;
        return `${val} degrees Fahrenheit is ${result.toFixed(1)} degrees Celsius.`;
      }
    }

    // Identity
    if (lower.includes('who are you') || lower.includes('what are you')) {
      return "I'm Jarvis, your personal assistant. I'm here to help with whatever you need. Think of me as your right hand — always ready, never sleeping.";
    }

    // How are you
    if (lower.includes('how are you') || lower.includes("how're you")) {
      const responses = [
        "All systems running smoothly. More importantly, how are you?",
        "Fully operational and at your service. What do you need?",
        "I'm functioning within normal parameters. Thank you for asking.",
        "Running well. Ready for whatever you have in mind."
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }

    // Thank you
    if (lower.includes('thank you') || lower.includes('thanks')) {
      const responses = [
        "You're welcome. That's what I'm here for.",
        "Of course. Happy to help.",
        "Anytime. What else do you need?",
        "My pleasure. Shall we continue?"
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }

    // Clear memory
    if (lower.includes('clear memory') || lower.includes('forget everything') || lower.includes('reset memory')) {
      this.clearMemory();
      return "Memory cleared. We're starting fresh. I won't remember any of our previous conversations.";
    }

    // Help
    if (lower.includes('what can you do') || lower.includes('help me') || lower === 'help') {
      return "I can tell you the time and date, remember your name, do quick calculations and temperature conversions, and hold a basic conversation. More capabilities are coming in future updates. What would you like to try?";
    }

    // Goodbye
    if (lower.includes('goodbye') || lower.includes('good night') || lower.includes('see you') || lower.includes('shut down')) {
      const name = this.memory.userName;
      const responses = [
        `Until next time${name ? ', ' + name : ''}. I'll be here when you need me.`,
        `Goodbye${name ? ', ' + name : ''}. Rest well.`,
        `Standing by${name ? ', ' + name : ''}. Just say the word when you're back.`
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }

    // Correction handling
    if (lower.startsWith('no,') || lower.startsWith('actually,') || lower.startsWith("that's wrong")) {
      return "I stand corrected. I'll keep that in mind going forward. What was the right answer?";
    }

    // Fallback
    const fallbacks = [
      "I'm not sure I follow. Could you rephrase that?",
      "I don't have a good answer for that yet, but I'm learning. Could you try asking differently?",
      "That's outside my current capabilities, I'm afraid. I'll be more helpful as I'm updated.",
      "I want to be honest — I'm not certain how to help with that right now. What else can I do for you?"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  // Evaluate simple arithmetic safely without eval()
  _safeMathEval(expr) {
    // Only allow digits, operators, spaces, parens, decimals
    if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr)) return null;
    try {
      const fn = new Function('return (' + expr + ')');
      const result = fn();
      if (typeof result === 'number' && isFinite(result)) {
        return Number.isInteger(result) ? result : parseFloat(result.toFixed(6));
      }
    } catch (e) {}
    return null;
  }
}
