// synth.js - Loop Machine Audio Engine using Tone.js
// Single master sequencer with editable step patterns

const SCALES = {
  major:         [0, 2, 4, 5, 7, 9, 11],
  minor:         [0, 2, 3, 5, 7, 8, 10],
  dorian:        [0, 2, 3, 5, 7, 9, 10],
  phrygian:      [0, 1, 3, 5, 7, 8, 10],
  lydian:        [0, 2, 4, 6, 7, 9, 11],
  mixolydian:    [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  hungarianMin:  [0, 2, 3, 6, 7, 8, 11],
  locrian:       [0, 1, 3, 5, 6, 8, 10],
  pentatonicMaj: [0, 2, 4, 7, 9],
  pentatonicMin: [0, 3, 5, 7, 10],
  blues:         [0, 3, 5, 6, 7, 10],
  wholeTone:     [0, 2, 4, 6, 8, 10],
  chromatic:     [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ROOTS      = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const FLAT_TO_SHARP = { 'Bb':'A#','Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#' };
function m2n(m)  { return NOTE_NAMES[((m%12)+12)%12] + Math.floor(m/12 - 1); }
function n2m(n)  {
  const p = n.match(/^([A-Gb#]+)(-?\d+)$/);
  if (!p) return 60;
  const name = FLAT_TO_SHARP[p[1]] || p[1];
  const idx = NOTE_NAMES.indexOf(name);
  return idx >= 0 ? (parseInt(p[2])+1)*12 + idx : 60;
}

function scaleNotes(root, oct, sc, count) {
  const b = n2m(root+oct), iv = SCALES[sc], o = [];
  for (let i = 0; i < count; i++) o.push(m2n(b + iv[i % iv.length] + Math.floor(i / iv.length) * 12));
  return o;
}

function chordNotes(root, oct, sc, degrees) {
  const b = n2m(root+oct), iv = SCALES[sc];
  return degrees.map(d => {
    const idx = ((d % iv.length) + iv.length) % iv.length;
    return m2n(b + iv[idx] + Math.floor(d / iv.length) * 12);
  });
}

const pick  = a => a[Math.floor(Math.random()*a.length)];
const coin  = (p=0.5) => Math.random() < p;

/* ═══════════════ PATTERN GENERATORS (all at 16th-note resolution) ═══════════════ */

const BASS_STYLES = ['rolling','galloping','syncopated','offbeat','pulsing'];
const LEAD_STYLES = ['arpeggio','melody','staccato','wide'];
const HAT_STYLES  = ['standard','sixteenths','sparse','busy'];
const KICK_STYLES = ['four','offkick','skipbeat'];
const CLAP_STYLES = ['backbeat','trap','breakbeat','minimal'];
const PERC_STYLES = ['sparse','shaker','conga','rim'];
const STAB_STYLES = ['sparse','offbeat','rhythmic','accent'];

function genKick(steps, style) {
  const p = new Array(steps).fill(null);
  for (let i = 0; i < steps; i++) {
    switch (style) {
      case 'four':     if (i%4===0) p[i]='C1'; break;
      case 'offkick':  if (i%4===0) p[i]='C1'; else if (i%4===3&&coin(0.2)) p[i]='C1'; break;
      case 'skipbeat': { const beat=Math.floor((i%16)/4); if (i%4===0&&!(beat===2&&coin(0.5))) p[i]='C1'; } break;
    }
  }
  return p;
}

function genBass(steps, root, sc, style) {
  const rm = n2m(root+'1'), iv = SCALES[sc], p = new Array(steps).fill(null);
  const deg = () => coin(0.82) ? 0 : pick([iv[3]||5, iv[4]||7, iv[2]||3]);
  for (let i = 0; i < steps; i++) {
    switch (style) {
      case 'rolling':
        if (coin(0.93)) { const hi=(i%2===1&&coin(0.72))?12:0; p[i]=m2n(rm+deg()+hi); } break;
      case 'galloping':
        { const pos=i%8; if ((pos===0||pos===3||pos===4||pos===7)&&coin(0.9)) p[i]=m2n(rm+deg()+(pos>=4?12:0)); } break;
      case 'syncopated':
        { const hits=[0,3,4,6,8,11,12,14]; if (hits.includes(i%16)&&coin(0.88)) p[i]=m2n(rm+deg()+(coin(0.5)?12:0)); } break;
      case 'offbeat':
        { const pos=i%4;
          if (pos===2&&coin(0.9)) p[i]=m2n(rm+(coin(0.6)?12:0));
          else if (pos===0&&coin(0.2)) p[i]=m2n(rm);
          else if (coin(0.08)) p[i]=m2n(rm+12);
        } break;
      case 'pulsing':
        if (coin(0.96)) { const d=(i%16>12&&coin(0.4))?pick([5,7,3]):0; p[i]=m2n(rm+d); } break;
    }
  }
  return p;
}

function genHats(steps, style) {
  const p = new Array(steps).fill(null);
  for (let i = 0; i < steps; i++) {
    switch (style) {
      case 'standard':   if (i%4===2) p[i]='open'; else if (coin(0.5)) p[i]='closed'; break;
      case 'sixteenths': if (i%4===2) p[i]='open'; else if (coin(0.85)) p[i]=i%2===0?'accent':'closed'; break;
      case 'sparse':     if (i%8===4) p[i]='open'; else if (i%4===2&&coin(0.4)) p[i]='closed'; break;
      case 'busy':       if (i%4===2) p[i]='open'; else if (i%16>=12) p[i]=coin(0.8)?'roll':'closed'; else if (coin(0.6)) p[i]='closed'; break;
    }
  }
  return p;
}

function genClap(steps, style) {
  const p = new Array(steps).fill(null);
  for (let i = 0; i < steps; i++) {
    const beat = (i%16)/4;
    const pos = i%16;
    switch (style) {
      case 'backbeat':
        if ((beat===1||beat===3)&&i%4===0) p[i]=1;
        else if (beat===3.5&&coin(0.15)) p[i]=1;
        break;
      case 'trap':
        if (beat===1&&i%4===0) p[i]=1;
        else if (beat===3&&i%4===0) p[i]=1;
        else if (pos>=12&&coin(0.4)) p[i]=1;
        else if ((pos===6||pos===10)&&coin(0.15)) p[i]=1;
        break;
      case 'breakbeat':
        if ((pos===4||pos===10)&&coin(0.85)) p[i]=1;
        else if ((pos===3||pos===7||pos===13)&&coin(0.25)) p[i]=1;
        break;
      case 'minimal':
        if (beat===3&&i%4===0) p[i]=1;
        break;
    }
  }
  return p;
}

function genAcid(steps, root, sc) {
  const notes = scaleNotes(root, 2, sc, 12);
  const style = pick(['sequence','random','repeated','call_response']);
  const p = new Array(steps).fill(null);
  switch (style) {
    case 'sequence':
      { const dir = coin()?1:-1; let idx = dir>0?0:notes.length-1;
        for (let i=0;i<steps;i+=2) { if (coin(0.7)) { p[i]=notes[idx]; idx=((idx+dir)%notes.length+notes.length)%notes.length; } }
      } break;
    case 'random':
      for (let i=0;i<steps;i+=2) { if (coin(0.65)) p[i]=pick(notes); } break;
    case 'repeated':
      { const motif=Array.from({length:pick([3,4,5])},()=>coin(0.7)?pick(notes):null);
        for (let i=0;i<steps;i+=2) p[i]=motif[(i/2)%motif.length];
      } break;
    case 'call_response':
      { const half=Math.floor(steps/4);
        const call=Array.from({length:half},()=>coin(0.6)?pick(notes):null);
        const resp=call.map(n=>n?pick(notes):null);
        const combined=[...call,...resp];
        for (let i=0;i<steps;i+=2) p[i]=combined[i/2]||null;
      } break;
  }
  return p;
}

function genLead(steps, root, sc, style) {
  const notes = scaleNotes(root, 4, sc, 14);
  const p = new Array(steps).fill(null);
  switch (style) {
    case 'arpeggio':
      for (let i=0;i<steps;i+=2) { if (coin(0.45)) p[i]=notes[(i/2)%notes.length]; } break;
    case 'melody':
      { let idx=Math.floor(notes.length/2);
        for (let i=0;i<steps;i+=2) { if (coin(0.5)) { p[i]=notes[idx]; idx=Math.max(0,Math.min(notes.length-1,idx+pick([-2,-1,0,1,2]))); } }
      } break;
    case 'staccato':
      { const bl=pick([2,3,4]),gap=pick([2,3,4]);
        for (let i=0;i<steps;i+=2) { if ((i/2)%(bl+gap)<bl&&coin(0.8)) p[i]=pick(notes); }
      } break;
    case 'wide':
      for (let i=0;i<steps;i+=2) { if (coin(0.35)) p[i]=notes[pick([0,2,4,6,8,10])%notes.length]; } break;
  }
  return p;
}

function genPerc(steps, style) {
  const p = new Array(steps).fill(null);
  for (let i = 0; i < steps; i++) {
    const pos = i%16;
    switch (style) {
      case 'sparse':
        if (pos>=14&&coin(0.4)) p[i]=1;
        else if (coin(0.08)) p[i]=1;
        break;
      case 'shaker':
        if (coin(0.75)) p[i]=1;
        break;
      case 'conga':
        if ((pos===0||pos===3||pos===7||pos===10||pos===12)&&coin(0.8)) p[i]=1;
        else if ((pos===5||pos===14)&&coin(0.3)) p[i]=1;
        break;
      case 'rim':
        if (pos%4===2&&coin(0.8)) p[i]=1;
        else if ((pos===1||pos===7||pos===11)&&coin(0.3)) p[i]=1;
        break;
    }
  }
  return p;
}

function genStab(steps, style) {
  const p = new Array(steps).fill(null);
  for (let i = 0; i < steps; i++) {
    const pos = i%16;
    switch (style) {
      case 'sparse':
        if ((pos===6||pos===14)&&coin(0.6)) p[i]=1;
        else if (pos===10&&coin(0.3)) p[i]=1;
        break;
      case 'offbeat':
        if (pos%4===2&&coin(0.5)) p[i]=1;
        else if ((pos===1||pos===5)&&coin(0.2)) p[i]=1;
        break;
      case 'rhythmic':
        if (pos%4===0&&coin(0.7)) p[i]=1;
        else if (pos%4===2&&coin(0.2)) p[i]=1;
        break;
      case 'accent':
        if (pos===0&&coin(0.85)) p[i]=1;
        else if ((pos===8||pos===12)&&coin(0.4)) p[i]=1;
        break;
    }
  }
  return p;
}

/* ═══════════════ GENRE PRESETS ═══════════════ */
const GENRE_PRESETS = {
  house:     { bpmRange:[120,130], scales:['minor','dorian','pentatonicMin'], kicks:['four'], bass:['pulsing','offbeat'], hats:['standard','busy'], claps:['backbeat'], percs:['shaker'], stabs:['offbeat'], leads:['melody','arpeggio'] },
  techno:    { bpmRange:[128,140], scales:['minor','phrygian','dorian'], kicks:['four','offkick'], bass:['rolling','pulsing'], hats:['sixteenths','busy'], claps:['minimal','backbeat'], percs:['rim','sparse'], stabs:['rhythmic'], leads:['staccato','arpeggio'] },
  psytrance: { bpmRange:[138,150], scales:['phrygian','harmonicMinor','hungarianMin'], kicks:['four'], bass:['rolling','galloping'], hats:['sixteenths','busy'], claps:['minimal'], percs:['sparse'], stabs:['sparse','accent'], leads:['arpeggio','staccato'] },
  dnb:       { bpmRange:[170,180], scales:['minor','blues','pentatonicMin'], kicks:['skipbeat','offkick'], bass:['syncopated','rolling'], hats:['busy','standard'], claps:['breakbeat'], percs:['rim','conga'], stabs:['accent'], leads:['melody','wide'] },
  hiphop:    { bpmRange:[85,100],  scales:['pentatonicMin','blues','minor'], kicks:['skipbeat','offkick'], bass:['syncopated','offbeat'], hats:['sparse','standard'], claps:['trap','backbeat'], percs:['conga','rim'], stabs:['sparse'], leads:['melody','wide'] },
  ambient:   { bpmRange:[70,100],  scales:['major','lydian','pentatonicMaj','wholeTone'], kicks:['four'], bass:['pulsing'], hats:['sparse'], claps:['minimal'], percs:['sparse'], stabs:['sparse'], leads:['wide','melody'] },
  rock:      { bpmRange:[110,140], scales:['major','pentatonicMin','blues','mixolydian'], kicks:['four','skipbeat'], bass:['pulsing','galloping'], hats:['standard'], claps:['backbeat'], percs:['rim'], stabs:['accent'], leads:['melody','staccato'] },
  pop:       { bpmRange:[100,130], scales:['major','minor','pentatonicMaj','mixolydian'], kicks:['four'], bass:['pulsing','offbeat'], hats:['standard','sparse'], claps:['backbeat'], percs:['shaker'], stabs:['offbeat'], leads:['melody','arpeggio'] },
};

/* ═══════════════ SEQUENCER INSTRUMENT LIST ═══════════════ */
export const SEQ_INSTRUMENTS = ['kick','bass','hat','clap','acid','lead','perc','stab'];
export const SEQ_LABELS      = ['KCK','BAS','HAT','CLP','ACD','LED','PRC','STB'];
export const SEQ_COLORS      = ['#ff4444','#c060ff','#00cccc','#e0e0e0','#44ff44','#4488ff','#ffcc00','#ff44aa'];
export const SAMPLE_SLOTS    = 4;
export { SCALES, ROOTS, BASS_STYLES, LEAD_STYLES, HAT_STYLES, KICK_STYLES, CLAP_STYLES, PERC_STYLES, STAB_STYLES, GENRE_PRESETS };

/* ═══════════════ MAIN CLASS ═══════════════ */

export class LoopSynth {
  constructor() {
    this.bpm          = 128;
    this.intensity    = 0.5;
    this.filterCutoff = 4000;
    this.loopLength   = 2;
    this.isPlaying    = false;
    this.root         = 'C';
    this.scale        = 'minor';
    this.sequences    = [];
    this._kick        = false;
    this._currentStep = 0;
    this.initialized  = false;
    this.patterns       = {};
    this.instState      = {};   // per-instrument: 'normal' | 'force' | 'mute'
    this.hits           = {};   // per-instrument per-step hit count arrays

    // sample player slots (S1-S4)
    this.samplePlayers  = [null, null, null, null];
    this.sampleBuffers  = [null, null, null, null];
    this.sampleNames    = ['', '', '', ''];

    // song arranger
    this.arrangement   = [];     // ordered list of bar indices, e.g. [0,1,0,1,2,3]
    this.songMode      = false;  // false = loop mode, true = song mode (play arrangement)
    this._arrangementStep = 0;   // current position in arrangement playback
    this.onArrangementPos = null; // callback(arrIdx, barIdx) for UI updates

    this.bassStyle = pick(BASS_STYLES);
    this.leadStyle = pick(LEAD_STYLES);
    this.hatStyle  = pick(HAT_STYLES);
    this.kickStyle = pick(KICK_STYLES);
    this.clapStyle = pick(CLAP_STYLES);
    this.percStyle = pick(PERC_STYLES);
    this.stabStyle = pick(STAB_STYLES);
  }

  async init() {
    if (this.initialized) return;
    await Tone.start();
    Tone.Transport.bpm.value = this.bpm;

    // master chain  (filter → distortion → compressor → limiter → gain → analysers → out)
    this.masterFilter = new Tone.Filter(this.filterCutoff, 'lowpass', -24);
    this.masterFilter.Q.value = 2;
    this.distortion   = new Tone.Distortion(0);
    this.distortion.wet.value = 1;
    this.compressor   = new Tone.Compressor(-18, 4);
    this.limiter      = new Tone.Limiter(-2);
    this.masterGain   = new Tone.Gain(0.72);
    this.fftNode      = new Tone.Analyser('fft', 256);
    this.waveNode     = new Tone.Analyser('waveform', 256);

    this.masterFilter.chain(this.distortion, this.compressor, this.limiter, this.masterGain);
    this.masterGain.connect(this.fftNode);
    this.masterGain.connect(this.waveNode);
    this.masterGain.toDestination();

    this._buildInstruments();

    // Connect any pre-loaded sample players
    for (let s = 0; s < SAMPLE_SLOTS; s++) {
      if (this.sampleBuffers[s]) this._createSamplePlayer(s);
    }

    // Preserve patterns created before init (e.g. from UI edits)
    if (Object.keys(this.patterns).length === 0) {
      this.generatePatterns();
    } else {
      this._rebuildSequence();
    }
    this.initialized = true;
  }

  /* ─────────── instruments ─────────── */
  _buildInstruments() {
    this.kickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05, octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 },
    }).connect(this.masterFilter);
    this.kickSynth.volume.value = -4;

    this.sub = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0.5, release: 0.08 },
    }).connect(this.masterFilter);
    this.sub.volume.value = -10;

    this.bassGain = new Tone.Gain(1);
    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 6, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0.15, release: 0.03 },
      filterEnvelope: { attack: 0.001, decay: 0.08, sustain: 0.2, release: 0.03, baseFrequency: 80, octaves: 2.5 },
    });
    this.bass.set({ portamento: 0.015 });
    this.bass.connect(this.bassGain);
    this.bassGain.connect(this.masterFilter);
    this.bass.volume.value = -8;

    this.acid = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      filter: { Q: 14, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0.3, release: 0.08 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.15, release: 0.15, baseFrequency: 250, octaves: 3.5 },
    });
    this.acid.set({ portamento: 0.025 });
    this.acidDelay = new Tone.PingPongDelay('8n.', 0.25);
    this.acidDelay.wet.value = 0.2;
    this.acid.connect(this.acidDelay);
    this.acidDelay.connect(this.masterFilter);
    this.acid.volume.value = -14;

    this.acidLFO = new Tone.LFO(2, 300, 5000);
    this.acidLFO.connect(this.acid.filter.frequency);
    this.acidLFO.start();

    this.lead = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 },
    });
    this.leadDelay = new Tone.PingPongDelay('8n', 0.35);
    this.leadDelay.wet.value = 0.3;
    this.leadReverb = new Tone.Freeverb();
    this.leadReverb.dampening = 3000;
    this.leadReverb.roomSize.value = 0.7;
    this.leadReverb.wet.value = 0.35;
    this.lead.connect(this.leadDelay);
    this.leadDelay.connect(this.leadReverb);
    this.leadReverb.connect(this.masterFilter);
    this.lead.volume.value = -16;

    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', spread: 20, count: 3 },
      envelope: { attack: 1.2, decay: 0.8, sustain: 0.5, release: 2.5 },
    });
    this.padFilter = new Tone.Filter(1800, 'lowpass');
    this.padReverb = new Tone.Freeverb();
    this.padReverb.roomSize.value = 0.85;
    this.padReverb.dampening = 2500;
    this.padReverb.wet.value = 0.55;
    this.pad.connect(this.padFilter);
    this.padFilter.connect(this.padReverb);
    this.padReverb.connect(this.masterFilter);
    this.pad.volume.value = -24;

    this.stab = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square8' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 },
    });
    this.stabFilter = new Tone.Filter(3500, 'lowpass');
    this.stab.connect(this.stabFilter);
    this.stabFilter.connect(this.masterFilter);
    this.stab.volume.value = -18;

    this.hihat = new Tone.MetalSynth({
      frequency: 200, envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
    }).connect(this.masterFilter);
    this.hihat.volume.value = -20;

    this.openHat = new Tone.MetalSynth({
      frequency: 200, envelope: { attack: 0.001, decay: 0.12, release: 0.06 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
    }).connect(this.masterFilter);
    this.openHat.volume.value = -22;

    this.clap = new Tone.NoiseSynth({ noise:{type:'white'}, envelope:{attack:0.001,decay:0.13,sustain:0,release:0.09} });
    this.clapFilter = new Tone.Filter(3500, 'bandpass');
    this.clap.connect(this.clapFilter);
    this.clapFilter.connect(this.masterFilter);
    this.clap.volume.value = -16;

    this.perc = new Tone.NoiseSynth({ noise:{type:'white'}, envelope:{attack:0.001,decay:0.03,sustain:0,release:0.01} }).connect(this.masterFilter);
    this.perc.volume.value = -24;

    this.riser = new Tone.NoiseSynth({ noise:{type:'pink'}, envelope:{attack:2.0,decay:0.1,sustain:0.8,release:0.5} });
    this.riserFilter = new Tone.AutoFilter({ frequency:'4n', baseFrequency:200, octaves:4 });
    this.riserFilter.start();
    this.riser.connect(this.riserFilter);
    this.riserFilter.connect(this.masterFilter);
    this.riser.volume.value = -26;
  }

  /* ─────────── pattern generation ─────────── */
  generatePatterns() {
    const S = this.loopLength * 16;

    this.patterns = {
      kick:  genKick(S, this.kickStyle),
      bass:  genBass(S, this.root, this.scale, this.bassStyle),
      hat:   genHats(S, this.hatStyle),
      clap:  genClap(S, this.clapStyle),
      acid:  genAcid(S, this.root, this.scale),
      lead:  genLead(S, this.root, this.scale, this.leadStyle),
      perc:  genPerc(S, this.percStyle),
      stab:  genStab(S, this.stabStyle),
    };

    // Initialize hit counts (1 for active steps, 0 for inactive)
    for (const inst of SEQ_INSTRUMENTS) {
      this.hits[inst] = this.patterns[inst].map(v => v != null ? 1 : 0);
    }

    this._rebuildSequence();
  }

  /* ─────────── (re)build Tone.Sequence from current patterns ─────────── */
  _rebuildSequence() {
    const was = this.isPlaying;
    if (was) this.stop();
    this._disposeSeqs();

    const playbackSteps = this._getPlaybackSteps();
    const S = this.loopLength * 16;
    const self = this;
    const rootCh = chordNotes(this.root, 3, this.scale, [0, 2, 4]);
    const altCh  = chordNotes(this.root, 3, this.scale, [5, 0, 2]);
    const stabCh = chordNotes(this.root, 4, this.scale, [0, 2, 4]);

    const THRESHOLDS = { kick: 0, bass: 0.1, hat: 0.3, clap: 0.25, acid: 0.45, lead: 0.65, perc: 0.55, stab: 0.8 };

    function canPlay(inst) {
      const state = self.instState[inst] || 'normal';
      if (state === 'mute') return false;
      if (state === 'force') return true;
      return self.intensity >= (THRESHOLDS[inst] || 0);
    }

    function hitTimes(inst, step, time) {
      const n = (self.hits[inst]?.[step]) || 1;
      if (n <= 1) return [time];
      const sixteenth = 60 / self.bpm / 4;
      const spacing = sixteenth / n;
      const t = [];
      for (let h = 0; h < n; h++) t.push(time + spacing * h);
      return t;
    }

    // In song mode, seqIdx tracks position within the arrangement
    let seqIdx = 0;

    const seq = new Tone.Sequence((time, step) => {
      self._currentStep = step;
      const p = self.patterns;

      // fire arrangement position callback in song mode
      if (self.songMode && self.arrangement.length && self.onArrangementPos) {
        const arrIdx = Math.floor(seqIdx / 16);
        self.onArrangementPos(arrIdx, self.arrangement[arrIdx] || 0);
      }
      seqIdx = (seqIdx + 1) % playbackSteps.length;

      // kick + sidechain
      if (p.kick[step] && canPlay('kick')) {
        for (const t of hitTimes('kick', step, time))
          self.kickSynth.triggerAttackRelease(p.kick[step], '8n', t);
        self.bassGain.gain.setValueAtTime(0.18, time);
        self.bassGain.gain.exponentialRampToValueAtTime(1, time + 0.12);
        self._kick = true;
        self.sub.triggerAttackRelease(self.root + '1', '4n', time);
      }
      if (p.bass[step] && canPlay('bass'))
        for (const t of hitTimes('bass', step, time))
          self.bass.triggerAttackRelease(p.bass[step], '32n', t);

      if (p.hat[step] && canPlay('hat')) {
        const h = p.hat[step];
        for (const t of hitTimes('hat', step, time)) {
          if (h==='open')        self.openHat.triggerAttackRelease('16n', t);
          else if (h==='accent') self.hihat.triggerAttackRelease('32n', t);
          else if (h==='roll')   self.hihat.triggerAttackRelease('64n', t);
          else                    self.hihat.triggerAttackRelease('32n', t);
        }
      }
      if (p.clap[step] && canPlay('clap'))
        for (const t of hitTimes('clap', step, time))
          self.clap.triggerAttackRelease('16n', t);
      if (p.acid[step] && canPlay('acid'))
        for (const t of hitTimes('acid', step, time))
          self.acid.triggerAttackRelease(p.acid[step], '16n', t);
      if (p.lead[step] && canPlay('lead'))
        for (const t of hitTimes('lead', step, time))
          self.lead.triggerAttackRelease(p.lead[step], '8n', t);
      if (p.perc[step] && canPlay('perc'))
        for (const t of hitTimes('perc', step, time))
          self.perc.triggerAttackRelease('32n', t);
      if (p.stab[step] && canPlay('stab'))
        for (const t of hitTimes('stab', step, time))
          self.stab.triggerAttackRelease(stabCh, '32n', t);

      // pad (every bar)
      if (step % 16 === 0 && self.intensity >= 0.6) {
        const ch = (step > 0 && coin(0.3)) ? altCh : rootCh;
        self.pad.triggerAttackRelease(ch, '1m', time);
      }
      // riser (last bar in loop, or last bar in arrangement)
      const totalSteps = playbackSteps.length;
      const stepsFromEnd = totalSteps - seqIdx;
      if (stepsFromEnd === 16 && coin(0.6) && self.intensity >= 0.4)
        self.riser.triggerAttackRelease('1m', time);

    }, playbackSteps, '16n');

    this.sequences = [seq];
    if (was) this.start();
  }

  _disposeSeqs() {
    this.sequences.forEach(s => { s.stop(); s.dispose(); });
    this.sequences = [];
  }

  /* ─────────── step editing (cycles: off → 1hit → 2hits → 3hits → off) ─────────── */
  toggleStep(inst, step) {
    const p = this.patterns[inst];
    if (!p || step >= p.length) return null;
    if (!this.hits[inst]) this.hits[inst] = new Array(p.length).fill(0);

    if (p[step] == null) {
      switch (inst) {
        case 'kick':  p[step] = 'C1'; break;
        case 'bass':  p[step] = m2n(n2m(this.root+'1') + (step%2 ? 12 : 0)); break;
        case 'hat':   p[step] = 'closed'; break;
        case 'clap':  p[step] = 1; break;
        case 'acid':  p[step] = pick(scaleNotes(this.root, 2, this.scale, 8)); break;
        case 'lead':  p[step] = pick(scaleNotes(this.root, 4, this.scale, 10)); break;
        case 'perc':  p[step] = 1; break;
        case 'stab':  p[step] = 1; break;
      }
      this.hits[inst][step] = 1;
    } else if (this.hits[inst][step] < 3) {
      this.hits[inst][step]++;
    } else {
      p[step] = null;
      this.hits[inst][step] = 0;
    }
    return p[step] != null ? { value: p[step], hits: this.hits[inst][step] } : null;
  }

  /* ─────────── transport ─────────── */
  start() {
    if (this.isPlaying) return;
    this.sequences.forEach(s => s.start(0));
    // start all loaded sample players in sync
    for (let s = 0; s < SAMPLE_SLOTS; s++) {
      const pl = this.samplePlayers[s];
      if (pl?.buffer?.loaded) pl.start();
    }
    Tone.Transport.start();
    this.isPlaying = true;
  }
  stop() {
    Tone.Transport.stop();
    this.sequences.forEach(s => s.stop());
    // stop all sample players
    for (let s = 0; s < SAMPLE_SLOTS; s++) {
      const pl = this.samplePlayers[s];
      if (pl?.state === 'started') { try { pl.stop(); } catch (_) {} }
    }
    this.isPlaying = false;
  }

  /* ─────────── controls ─────────── */
  setBPM(v)       { this.bpm = v; Tone.Transport.bpm.value = v; }
  setIntensity(v) { this.intensity = v; }

  setFilterCutoff(freq) {
    this.filterCutoff = freq;
    this.masterFilter.frequency.rampTo(freq, 0.05);
    this.masterFilter.Q.rampTo(1 + (1 - freq / 20000) * 14, 0.05);
  }

  setLoopLength(bars) {
    const newLen = bars * 16;
    this.loopLength = bars;

    // Resize existing patterns: extend with nulls or truncate
    for (const inst of SEQ_INSTRUMENTS) {
      const p = this.patterns[inst];
      if (!p) continue;
      if (newLen > p.length) {
        this.patterns[inst] = [...p, ...new Array(newLen - p.length).fill(null)];
      } else {
        this.patterns[inst] = p.slice(0, newLen);
      }
      // resize hit counts
      const h = this.hits[inst];
      if (h) {
        this.hits[inst] = newLen > h.length
          ? [...h, ...new Array(newLen - h.length).fill(0)]
          : h.slice(0, newLen);
      }
    }

    this._rebuildSequence();
  }

  /** Clear all steps in a specific bar (0-indexed) */
  clearBar(barIndex) {
    const start = barIndex * 16;
    const end = Math.min(start + 16, this.loopLength * 16);
    for (const inst of SEQ_INSTRUMENTS) {
      const p = this.patterns[inst];
      if (!p) continue;
      for (let i = start; i < end; i++) {
        p[i] = null;
        if (this.hits[inst]) this.hits[inst][i] = 0;
      }
    }
  }

  /** Copy all patterns from one bar to another */
  copyBar(srcBar, dstBar) {
    const srcStart = srcBar * 16, dstStart = dstBar * 16;
    for (const inst of SEQ_INSTRUMENTS) {
      const p = this.patterns[inst];
      const h = this.hits[inst];
      if (!p) continue;
      for (let i = 0; i < 16; i++) {
        p[dstStart + i] = p[srcStart + i];
        if (h) h[dstStart + i] = h[srcStart + i] || 0;
      }
    }
  }

  /** Build the flat step array for song mode (arrangement) or loop mode */
  _getPlaybackSteps() {
    if (this.songMode && this.arrangement.length > 0) {
      // Build a flat array of step indices from the arrangement
      const steps = [];
      for (const barIdx of this.arrangement) {
        const base = barIdx * 16;
        for (let i = 0; i < 16; i++) steps.push(base + i);
      }
      return steps;
    }
    // loop mode: just play all bars sequentially
    return Array.from({length: this.loopLength * 16}, (_, i) => i);
  }

  /* ─────────── per-instrument mute/force ─────────── */
  cycleInstState(inst) {
    const states = ['normal', 'force', 'mute'];
    const cur = this.instState[inst] || 'normal';
    const next = states[(states.indexOf(cur) + 1) % states.length];
    this.instState[inst] = next;
    return next;
  }
  getInstState(inst) { return this.instState[inst] || 'normal'; }
  getHits(inst, step) { return this.hits[inst]?.[step] || (this.patterns[inst]?.[step] != null ? 1 : 0); }

  /* ─────────── state save/load (beat maps) ─────────── */
  getState() {
    return {
      bpm: this.bpm,
      loopLength: this.loopLength,
      root: this.root,
      scale: this.scale,
      bassStyle: this.bassStyle,
      leadStyle: this.leadStyle,
      hatStyle: this.hatStyle,
      kickStyle: this.kickStyle,
      clapStyle: this.clapStyle,
      percStyle: this.percStyle,
      stabStyle: this.stabStyle,
      patterns: JSON.parse(JSON.stringify(this.patterns)),
      hits: JSON.parse(JSON.stringify(this.hits)),
      instState: { ...this.instState },
      arrangement: [...this.arrangement],
    };
  }

  loadState(state) {
    if (state.bpm) { this.bpm = state.bpm; if (this.initialized) Tone.Transport.bpm.value = this.bpm; }
    if (state.loopLength) this.loopLength = state.loopLength;
    if (state.root) this.root = state.root;
    if (state.scale) this.scale = state.scale;
    if (state.bassStyle) this.bassStyle = state.bassStyle;
    if (state.leadStyle) this.leadStyle = state.leadStyle;
    if (state.hatStyle) this.hatStyle = state.hatStyle;
    if (state.kickStyle) this.kickStyle = state.kickStyle;
    if (state.clapStyle) this.clapStyle = state.clapStyle;
    if (state.percStyle) this.percStyle = state.percStyle;
    if (state.stabStyle) this.stabStyle = state.stabStyle;
    if (state.patterns) this.patterns = state.patterns;
    if (state.hits) this.hits = state.hits;
    if (state.instState) this.instState = state.instState;
    if (state.arrangement) this.arrangement = state.arrangement;
    this._rebuildSequence();
  }

  // -- sound design --
  setBassDecay(v) {
    if (!this.bass) return;
    this.bass.envelope.decay = v;
    this.bass.filterEnvelope.decay = v;
  }
  setAcidResonance(v) { if (this.acid) this.acid.filter.Q.value = v; }
  setAcidLFORate(v)   { if (this.acidLFO) this.acidLFO.frequency.value = v; }
  setReverbMix(v)     { if (this.leadReverb) { this.leadReverb.wet.value = v; this.padReverb.wet.value = v; } }
  setDelayMix(v)      { if (this.leadDelay) { this.leadDelay.wet.value = v; this.acidDelay.wet.value = v; } }
  setSwing(v)         { Tone.Transport.swing = v; Tone.Transport.swingSubdivision = '16n'; }
  setDistortion(v)    { if (this.distortion) this.distortion.distortion = v; }
  setKickPunch(v)     { if (this.kickSynth) this.kickSynth.pitchDecay = v; }

  /* ─────────── sample slots ─────────── */
  loadSampleToSlot(slot, audioBuffer, name = '') {
    if (slot < 0 || slot >= SAMPLE_SLOTS) return;
    this.sampleBuffers[slot] = audioBuffer;
    this.sampleNames[slot]   = name;
    if (this.initialized) this._createSamplePlayer(slot);
  }

  clearSampleSlot(slot) {
    if (slot < 0 || slot >= SAMPLE_SLOTS) return;
    if (this.samplePlayers[slot]) {
      try { this.samplePlayers[slot].stop(); } catch (_) {}
      this.samplePlayers[slot].dispose();
      this.samplePlayers[slot] = null;
    }
    this.sampleBuffers[slot] = null;
    this.sampleNames[slot]   = '';
  }

  _createSamplePlayer(slot) {
    if (this.samplePlayers[slot]) {
      try { this.samplePlayers[slot].stop(); } catch (_) {}
      this.samplePlayers[slot].dispose();
      this.samplePlayers[slot] = null;
    }
    if (!this.sampleBuffers[slot] || !this.masterFilter) return;
    const player = new Tone.Player(this.sampleBuffers[slot]);
    player.loop = true;
    player.connect(this.masterFilter);
    player.volume.value = -6;
    this.samplePlayers[slot] = player;
    // auto-start if transport is already playing
    if (this.isPlaying) player.start();
  }

  setSampleVolume(slot, db) {
    if (this.samplePlayers[slot]) this.samplePlayers[slot].volume.value = db;
  }

  setSampleMute(slot, muted) {
    if (this.samplePlayers[slot]) this.samplePlayers[slot].mute = muted;
  }

  setSampleLoop(slot, loop) {
    if (this.samplePlayers[slot]) this.samplePlayers[slot].loop = loop;
  }

  /** Generate a bridge/transition bar and add it to the pattern pool.
   *  type: 'buildup' | 'breakdown' | 'fill' | 'drop'
   *  Returns the bar index of the new bridge bar. */
  generateBridge(type = 'buildup') {
    const newBar = this.loopLength;
    this.setLoopLength(newBar + 1);
    const base = newBar * 16;

    // Clear the new bar first
    for (const inst of SEQ_INSTRUMENTS) {
      for (let i = 0; i < 16; i++) {
        this.patterns[inst][base + i] = null;
        this.hits[inst][base + i] = 0;
      }
    }

    const notes = scaleNotes(this.root, 2, this.scale, 8);
    const highNotes = scaleNotes(this.root, 4, this.scale, 8);

    switch (type) {
      case 'buildup':
        // Accelerating hats + rising perc density + riser
        for (let i = 0; i < 16; i++) {
          // hats: start sparse, get denser
          if (i >= 12) { this.patterns.hat[base + i] = 'roll'; this.hits.hat[base + i] = 3; }
          else if (i >= 8) { this.patterns.hat[base + i] = 'closed'; this.hits.hat[base + i] = 2; }
          else if (i >= 4 && i % 2 === 0) { this.patterns.hat[base + i] = 'closed'; this.hits.hat[base + i] = 1; }
          // kick: 4 on the floor, dropping out near end for tension
          if (i % 4 === 0 && i < 12) { this.patterns.kick[base + i] = 'C1'; this.hits.kick[base + i] = 1; }
          // perc fills in final quarter
          if (i >= 12 && coin(0.7)) { this.patterns.perc[base + i] = 1; this.hits.perc[base + i] = 2; }
          // snare/clap roll at end
          if (i >= 14) { this.patterns.clap[base + i] = 1; this.hits.clap[base + i] = 3; }
          // rising bass
          if (i % 4 === 0) { this.patterns.bass[base + i] = m2n(n2m(this.root + '1') + Math.floor(i / 4) * 2); this.hits.bass[base + i] = 1; }
        }
        break;

      case 'breakdown':
        // Strip everything back — just pad + sparse acid
        for (let i = 0; i < 16; i++) {
          if (i % 8 === 0) { this.patterns.acid[base + i] = pick(notes); this.hits.acid[base + i] = 1; }
          if (i === 0) { this.patterns.stab[base + i] = 1; this.hits.stab[base + i] = 1; }
        }
        break;

      case 'fill':
        // Dense drum fill — all perc instruments active
        for (let i = 0; i < 16; i++) {
          // kick pattern: syncopated
          if ((i === 0 || i === 3 || i === 6 || i === 10 || i === 13) && coin(0.8)) {
            this.patterns.kick[base + i] = 'C1'; this.hits.kick[base + i] = 1;
          }
          // snare rolls
          if (i >= 4) { this.patterns.clap[base + i] = 1; this.hits.clap[base + i] = i >= 12 ? 3 : i >= 8 ? 2 : 1; }
          // hats throughout
          this.patterns.hat[base + i] = i % 4 === 2 ? 'open' : 'closed';
          this.hits.hat[base + i] = 1;
          // perc accents
          if (i % 3 === 0) { this.patterns.perc[base + i] = 1; this.hits.perc[base + i] = 1; }
        }
        break;

      case 'drop':
        // Full energy: all instruments, heavy kick + bass
        for (let i = 0; i < 16; i++) {
          // four-on-floor kick
          if (i % 4 === 0) { this.patterns.kick[base + i] = 'C1'; this.hits.kick[base + i] = 1; }
          // rolling bass
          this.patterns.bass[base + i] = m2n(n2m(this.root + '1') + (i % 2 ? 12 : 0));
          this.hits.bass[base + i] = 1;
          // hats
          this.patterns.hat[base + i] = i % 4 === 2 ? 'open' : 'accent';
          this.hits.hat[base + i] = 1;
          // clap on 2 and 4
          if (i % 8 === 4) { this.patterns.clap[base + i] = 1; this.hits.clap[base + i] = 1; }
          // acid line
          if (i % 2 === 0 && coin(0.7)) { this.patterns.acid[base + i] = pick(notes); this.hits.acid[base + i] = 1; }
          // lead stabs
          if ((i === 0 || i === 6 || i === 12) && coin(0.6)) { this.patterns.stab[base + i] = 1; this.hits.stab[base + i] = 1; }
        }
        break;
    }

    this._rebuildSequence();
    return newBar;
  }

  /* ─────────── randomize ─────────── */
  randomize() {
    this.root      = pick(ROOTS);
    this.scale     = pick(Object.keys(SCALES));
    this.bassStyle = pick(BASS_STYLES);
    this.leadStyle = pick(LEAD_STYLES);
    this.hatStyle  = pick(HAT_STYLES);
    this.kickStyle = pick(KICK_STYLES);
    this.clapStyle = pick(CLAP_STYLES);
    this.percStyle = pick(PERC_STYLES);
    this.stabStyle = pick(STAB_STYLES);

    if (this.bass && coin(0.4)) this.bass.oscillator.type = pick(['sawtooth','square','fatsawtooth']);
    if (this.acid && coin(0.35)) this.acid.oscillator.type = pick(['square','sawtooth','pulse']);
    if (this.lead && coin(0.3)) this.lead.set({ oscillator:{ type:pick(['triangle8','sawtooth8','square8','fatsawtooth']) }});

    const was = this.isPlaying;
    if (was) this.stop();
    this.generatePatterns();
    if (was) this.start();

    return { root:this.root, scale:this.scale, bass:this.bassStyle, lead:this.leadStyle, hats:this.hatStyle, kick:this.kickStyle, clap:this.clapStyle, perc:this.percStyle, stab:this.stabStyle };
  }

  /* ─────────── genre preset randomize ─────────── */
  randomizeGenre(genre) {
    const preset = GENRE_PRESETS[genre];
    if (!preset) return this.randomize();

    const [lo, hi] = preset.bpmRange;
    this.bpm = lo + Math.floor(Math.random() * (hi - lo + 1));
    if (this.initialized) Tone.Transport.bpm.value = this.bpm;

    this.root      = pick(ROOTS);
    this.scale     = pick(preset.scales);
    this.kickStyle = pick(preset.kicks);
    this.bassStyle = pick(preset.bass);
    this.hatStyle  = pick(preset.hats);
    this.clapStyle = pick(preset.claps);
    this.percStyle = pick(preset.percs);
    this.stabStyle = pick(preset.stabs);
    this.leadStyle = pick(preset.leads);

    const was = this.isPlaying;
    if (was) this.stop();
    this.generatePatterns();
    if (was) this.start();

    return { root:this.root, scale:this.scale, bpm:this.bpm, bass:this.bassStyle, lead:this.leadStyle, hats:this.hatStyle, kick:this.kickStyle, clap:this.clapStyle, perc:this.percStyle, stab:this.stabStyle };
  }

  /* ─────────── analysis ─────────── */
  getAudioData() {
    if (!this.fftNode) return null;
    const fft = this.fftNode.getValue(), wave = this.waveNode.getValue();
    let bass=0, mid=0, high=0;
    const len = fft.length;
    for (let i=0;i<len;i++) {
      const v = Math.max(0,(fft[i]+100)/100);
      if (i<len*0.08) bass+=v; else if (i<len*0.45) mid+=v; else high+=v;
    }
    bass=Math.min(1,bass/(len*0.08)); mid=Math.min(1,mid/(len*0.37)); high=Math.min(1,high/(len*0.55));
    const kick=this._kick; this._kick=false;
    return { fft, waveform:wave, bass, mid, high, kick, bpm:this.bpm, intensity:this.intensity, filterCutoff:this.filterCutoff };
  }

  getLoopProgress() {
    if (!this.isPlaying) return 0;
    const barSec = (60 / this.bpm) * 4;
    const totalBars = (this.songMode && this.arrangement.length) ? this.arrangement.length : this.loopLength;
    const loopSec = barSec * totalBars;
    return (Tone.Transport.seconds % loopSec) / loopSec;
  }
}
