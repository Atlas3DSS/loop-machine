# PSY LOOP MACHINE

Browser-based psytrance synthesizer with reactive 3D visuals and AI-powered audio generation.

## Features

- **Step Sequencer** — 8-instrument pattern grid with per-instrument mute/force and multi-hit ratchets
- **Audio Engine** — Tone.js synth with kick, bass, hi-hats, claps, acid, lead, perc, stabs
- **3D Visuals** — Three.js reactive tunnel/geometry that responds to audio in real-time
- **AI Textures** — Generate psychedelic textures via Google Gemini
- **AI Samples** — Generate audio clips via ACE-Step 1.5 with tag-based prompting (up to 240s)
- **Sample Mixer** — 4 loop slots with volume, mute, loop controls
- **Clip Editor** — Trim any sample with waveform display and preview
- **Beat Maps** — Save/load sequencer patterns with BPM and key
- **Sample Library** — Browse, rename, download, and manage generated clips

## Quick Start

```bash
python3 server.py 8080
```

Open `http://localhost:8080` in your browser.

## ACE-Step Integration

For AI audio generation, run an [ACE-Step 1.5](https://github.com/ace-step/ACE-Step) server on port 8001. The proxy server forwards `/ace-api/*` requests automatically.

```bash
ACE_STEP_URL=http://localhost:8001 python3 server.py 8080
```

## Configuration

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

- `GOOGLE_API_KEY` — Required for AI texture generation (Google Gemini)

## Tech Stack

- [Tone.js](https://tonejs.github.io/) — Web Audio synthesis
- [Three.js](https://threejs.org/) — 3D graphics
- [ACE-Step](https://github.com/ace-step/ACE-Step) — AI music generation (optional)
- Google Gemini — AI image generation (optional)
