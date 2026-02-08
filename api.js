// api.js - Gemini image generation for psychedelic textures
// Uses gemini-3-pro-image-preview via generateContent endpoint
// Persists generated textures in IndexedDB

/* ═══════════ IndexedDB texture store ═══════════ */

class TextureStore {
  constructor() {
    this.dbName    = 'psy_textures';
    this.storeName = 'textures';
    this.db        = null;
  }

  async open() {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror   = () => reject(req.error);
    });
  }

  async save(entry) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx  = this.db.transaction(this.storeName, 'readwrite');
      const req = tx.objectStore(this.storeName).add(entry);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async getAll() {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx  = this.db.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async remove(id) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx  = this.db.transaction(this.storeName, 'readwrite');
      const req = tx.objectStore(this.storeName).delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async clear() {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx  = this.db.transaction(this.storeName, 'readwrite');
      const req = tx.objectStore(this.storeName).clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }
}

/* ═══════════ API class ═══════════ */

export class ImagenAPI {
  constructor(apiKey = '') {
    this.apiKey     = apiKey;
    this.gallery    = [];   // in-memory cache: { id, dataUrl, prompt, ts }
    this.busy       = false;
    this.basePrompt = 'psychedelic seamless texture, vibrant neon colors, ';
    this.model      = 'gemini-3-pro-image-preview';
    this.store      = new TextureStore();
  }

  setApiKey(key) { this.apiKey = key; }

  /** Load all previously saved textures from IndexedDB into gallery */
  async loadSaved() {
    try {
      const rows = await this.store.getAll();
      this.gallery = rows.map(r => ({
        id: r.id, dataUrl: r.dataUrl, prompt: r.prompt, ts: r.ts,
      }));
      return this.gallery;
    } catch (e) {
      console.warn('Failed to load saved textures:', e);
      return [];
    }
  }

  /**
   * Generate a psychedelic texture via Gemini image generation.
   * Automatically persists the result to IndexedDB.
   */
  async generateTexture(userPrompt = '') {
    if (!this.apiKey) throw new Error('No API key configured');
    if (this.busy)    throw new Error('Generation already in progress');
    this.busy = true;

    const prompt = this.basePrompt +
      (userPrompt || 'sacred geometry, electric blues and acid greens, intricate fractal detail, dark background, tiling');

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: prompt }] },
            ],
            generationConfig: {
              responseModalities: ['IMAGE', 'TEXT'],
              imageConfig: { imageSize: '1K' },
            },
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API ${res.status}`);
      }

      const data  = await res.json();
      const parts = data.candidates?.[0]?.content?.parts;
      if (!parts) throw new Error('No content in API response');

      const imgPart = parts.find(p => p.inlineData?.data);
      if (!imgPart) throw new Error('No image returned from API');

      const { mimeType, data: b64 } = imgPart.inlineData;
      const dataUrl = `data:${mimeType || 'image/png'};base64,${b64}`;

      // persist to IndexedDB
      const entry = { dataUrl, prompt: userPrompt || '(default)', ts: Date.now() };
      try {
        entry.id = await this.store.save(entry);
      } catch (e) {
        console.warn('Failed to persist texture:', e);
      }

      this.gallery.push(entry);
      return dataUrl;
    } finally {
      this.busy = false;
    }
  }

  /** Delete a texture from gallery and IndexedDB */
  async deleteTexture(index) {
    const item = this.gallery[index];
    if (!item) return;
    if (item.id) {
      try { await this.store.remove(item.id); } catch (_) {}
    }
    this.gallery.splice(index, 1);
  }

  getGallery()       { return this.gallery; }
  getItem(i)         { return this.gallery[i]?.dataUrl ?? null; }
  get galleryCount() { return this.gallery.length; }
}
