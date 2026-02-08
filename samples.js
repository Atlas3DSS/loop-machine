// samples.js - ACE-Step sample generation + IndexedDB persistence

/* ═══════════ IndexedDB sample store ═══════════ */

class SampleStore {
  constructor() {
    this.dbName    = 'psy_samples';
    this.storeName = 'samples';
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

  async update(entry) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx  = this.db.transaction(this.storeName, 'readwrite');
      const req = tx.objectStore(this.storeName).put(entry);
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
}

/* ═══════════ SampleBank ═══════════ */

export class SampleBank {
  constructor(apiBase = '/ace-api') {
    this.apiBase    = apiBase;
    this.samples    = [];   // { id, name, prompt, duration, audioBlob, ts }
    this.store      = new SampleStore();
    this.busy       = false;
    this.onProgress = null; // callback(statusText)
  }

  /** Load previously saved samples from IndexedDB */
  async loadSaved() {
    try {
      this.samples = await this.store.getAll();
      return this.samples;
    } catch (e) {
      console.warn('Failed to load saved samples:', e);
      return [];
    }
  }

  /** Ping ACE-Step health endpoint */
  async checkConnection() {
    try {
      const r = await fetch(`${this.apiBase}/health`, { signal: AbortSignal.timeout(5000) });
      return r.ok;
    } catch { return false; }
  }

  /**
   * Generate an audio sample via ACE-Step.
   * Returns { id, name, prompt, duration, audioBlob, ts }
   */
  async generateSample({ prompt = '', lyrics = '', duration = 10, instrumental = true, inferenceSteps = 8, guidanceScale = 1, bpm = null, keyscale = '', seed, lmTemperature = 0.85, taskType = 'text2music', srcAudioBlob = null, referenceAudioBlob = null, audioCoverStrength = 1.0, repaintingStart = 0, repaintingEnd = null }) {
    if (this.busy) throw new Error('Generation already in progress');
    this.busy = true;

    try {
      this._emit('Submitting to ACE-Step...');

      const hasFiles = srcAudioBlob || referenceAudioBlob;
      let taskRes;

      if (hasFiles) {
        // FormData path for file uploads (cover, repaint, lego, extract, complete)
        const fd = new FormData();
        fd.append('prompt', prompt);
        fd.append('lyrics', lyrics || '[Instrumental]');
        fd.append('audio_duration', String(Math.max(10, duration)));
        fd.append('task_type', taskType);
        fd.append('instrumental', String(instrumental));
        fd.append('thinking', 'true');
        fd.append('use_cot_caption', 'true');
        fd.append('use_cot_metas', 'true');
        fd.append('use_cot_language', 'true');
        if (bpm) fd.append('bpm', String(bpm));
        if (keyscale) fd.append('keyscale', keyscale);
        if (seed != null) fd.append('seed', String(seed));
        fd.append('lm_temperature', String(lmTemperature));
        fd.append('batch_size', '1');
        fd.append('inference_steps', String(inferenceSteps));
        fd.append('guidance_scale', String(guidanceScale));
        fd.append('audio_format', 'wav');
        if (srcAudioBlob) fd.append('src_audio', srcAudioBlob, 'source.wav');
        if (referenceAudioBlob) fd.append('ref_audio', referenceAudioBlob, 'reference.wav');
        if (taskType === 'cover') fd.append('audio_cover_strength', String(audioCoverStrength));
        if (repaintingEnd != null) {
          fd.append('repainting_start', String(repaintingStart));
          fd.append('repainting_end', String(repaintingEnd));
        }
        taskRes = await fetch(`${this.apiBase}/release_task`, { method: 'POST', body: fd });
      } else {
        // JSON path for text2music (no files)
        taskRes = await fetch(`${this.apiBase}/release_task`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            lyrics: lyrics || '[Instrumental]',
            audio_duration: Math.max(10, duration),
            task_type: taskType,
            instrumental,
            thinking: true,
            use_cot_caption: true,
            use_cot_metas: true,
            use_cot_language: true,
            ...(bpm ? { bpm } : {}),
            ...(keyscale ? { keyscale } : {}),
            ...(seed != null ? { seed } : {}),
            lm_temperature: lmTemperature,
            batch_size: 1,
            inference_steps: inferenceSteps,
            guidance_scale: guidanceScale,
            audio_format: 'wav',
          }),
        });
      }

      if (!taskRes.ok) {
        const err = await taskRes.json().catch(() => ({}));
        throw new Error(err.error?.message || err.error || `API ${taskRes.status}`);
      }

      const taskData = await taskRes.json();
      const taskId   = taskData.data?.task_id;
      if (!taskId) throw new Error('No task_id returned');

      this._emit('Generating audio...');

      // poll for result (up to 10 min)
      // API expects task_id_list (array), returns data[].status (0=running,1=done,2=fail)
      // data[].result is a JSON string: [{ file: "/v1/audio?path=...", status, ... }]
      let audioUrl = null;
      for (let i = 0; i < 300; i++) {
        await new Promise(r => setTimeout(r, 2000));

        const pollRes = await fetch(`${this.apiBase}/query_result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id_list: [taskId] }),
        });
        const resp = await pollRes.json();
        const item = resp.data?.[0];

        if (item?.status === 1) {
          // result is a JSON string containing array of results
          try {
            const results = typeof item.result === 'string'
              ? JSON.parse(item.result) : item.result;
            audioUrl = results?.[0]?.file;
          } catch (_) {}
          break;
        }
        if (item?.status === 2) {
          throw new Error('Generation failed');
        }
        const progress = item?.progress_text || '';
        this._emit(`Generating... (${(i + 1) * 2}s)`);
      }

      if (!audioUrl) throw new Error('Generation timed out or no audio returned');

      this._emit('Downloading audio...');
      const audioRes = await fetch(`${this.apiBase}${audioUrl}`);
      if (!audioRes.ok) throw new Error('Failed to download audio');
      let audioBlob = await audioRes.blob();

      // Trim to requested duration if shorter than what ACE-Step generated
      if (duration < 10) {
        this._emit('Trimming to ' + duration + 's...');
        audioBlob = await this._trimBlob(audioBlob, duration);
      }

      const entry = {
        name:     prompt.slice(0, 50) || 'untitled',
        prompt,
        duration,
        audioBlob,
        ts: Date.now(),
      };

      try { entry.id = await this.store.save(entry); }
      catch (e) { console.warn('Failed to persist sample:', e); }

      this.samples.push(entry);
      this._emit('Sample ready!');
      return entry;

    } finally {
      this.busy = false;
    }
  }

  /** Delete a sample from bank and IndexedDB */
  async deleteSample(index) {
    const item = this.samples[index];
    if (!item) return;
    if (item.id) {
      try { await this.store.remove(item.id); } catch (_) {}
    }
    this.samples.splice(index, 1);
  }

  /** Rename a sample and persist to IndexedDB */
  async renameSample(index, newName) {
    const item = this.samples[index];
    if (!item) return;
    item.name = newName;
    if (item.id) {
      try { await this.store.update(item); } catch (_) {}
    }
  }

  /** Replace a sample's audio and persist to IndexedDB */
  async replaceSample(index, newBlob, newDuration) {
    const item = this.samples[index];
    if (!item) return;
    item.audioBlob = newBlob;
    item.duration = newDuration;
    if (item.id) {
      try { await this.store.update(item); } catch (_) {}
    }
  }

  getSample(index)  { return this.samples[index] || null; }
  get count()       { return this.samples.length; }

  _emit(msg) { if (this.onProgress) this.onProgress(msg); }

  /** Trim an audio blob to targetSeconds using Web Audio decode/re-encode */
  async _trimBlob(blob, targetSeconds) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      const sr  = buf.sampleRate;
      const ch  = buf.numberOfChannels;
      const len = Math.min(buf.length, Math.floor(targetSeconds * sr));

      const trimmed = new OfflineAudioContext(ch, len, sr);
      const src = trimmed.createBufferSource();
      const newBuf = trimmed.createBuffer(ch, len, sr);
      for (let c = 0; c < ch; c++) {
        newBuf.getChannelData(c).set(buf.getChannelData(c).subarray(0, len));
      }
      src.buffer = newBuf;
      src.connect(trimmed.destination);
      src.start();
      const rendered = await trimmed.startRendering();
      return this._encodeWav(rendered);
    } finally {
      ctx.close();
    }
  }

  /** Encode an AudioBuffer to a WAV Blob (16-bit PCM) */
  _encodeWav(buf) {
    const sr = buf.sampleRate, ch = buf.numberOfChannels, len = buf.length;
    const dataSize = len * ch * 2;
    const ab = new ArrayBuffer(44 + dataSize);
    const v = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0,'RIFF'); v.setUint32(4, 36 + dataSize, true); w(8,'WAVE');
    w(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true);
    v.setUint16(22, ch, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true);
    v.setUint16(34, 16, true); w(36,'data'); v.setUint32(40, dataSize, true);
    const chData = [];
    for (let c = 0; c < ch; c++) chData.push(buf.getChannelData(c));
    let off = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < ch; c++) {
        const s = Math.max(-1, Math.min(1, chData[c][i]));
        v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        off += 2;
      }
    }
    return new Blob([ab], { type: 'audio/wav' });
  }
}
