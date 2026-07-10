const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ENCRYPTION_KEY_LENGTH = 32;
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

class MemoryStore {
  constructor() {
    const userDataDir = process.env.APPDATA
      || process.env.HOME
      || path.join(__dirname, '..');
    const jarvisDir = path.join(userDataDir, '.jarvis');

    if (!fs.existsSync(jarvisDir)) {
      fs.mkdirSync(jarvisDir, { recursive: true });
    }

    this.filePath = path.join(jarvisDir, 'memory.json');
    this.keyPath = path.join(jarvisDir, '.key');
    this._ensureKey();
  }

  _ensureKey() {
    if (fs.existsSync(this.keyPath)) {
      this._key = fs.readFileSync(this.keyPath);
    } else {
      this._key = crypto.randomBytes(ENCRYPTION_KEY_LENGTH);
      fs.writeFileSync(this.keyPath, this._key, { mode: 0o600 });
    }
  }

  _encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this._key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  _decrypt(data) {
    const [ivHex, encrypted] = data.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, this._key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return this._defaultMemory();
      }
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const decrypted = this._decrypt(raw);
      return JSON.parse(decrypted);
    } catch (err) {
      console.error('Memory load failed, starting fresh:', err.message);
      return this._defaultMemory();
    }
  }

  save(data) {
    try {
      const json = JSON.stringify(data, null, 2);
      const encrypted = this._encrypt(json);
      fs.writeFileSync(this.filePath, encrypted, 'utf8');
      return true;
    } catch (err) {
      console.error('Memory save failed:', err.message);
      return false;
    }
  }

  clear() {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
      return true;
    } catch (err) {
      console.error('Memory clear failed:', err.message);
      return false;
    }
  }

  _defaultMemory() {
    return {
      userName: null,
      conversationHistory: [],
      corrections: {},
      firstLaunch: new Date().toISOString(),
      lastSeen: null
    };
  }
}

module.exports = MemoryStore;
