# GuitarMode

Real-time guitar note & scale/mode recognition in the browser. Play a few notes into your mic (or upload / record a sample) and GuitarMode will:

- Name the notes you played and show them on a timeline
- Rank likely scales & modes (17 templates: modes, pentatonics, blues, exotic)
- Detect chords and diatonic chord progressions
- Light up scale positions on an interactive 22-fret fretboard
- Generate AI-powered riffs via Claude and procedural solos

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- [`pitchy`](https://www.npmjs.com/package/pitchy) (YIN pitch detection)
- [`@spotify/basic-pitch`](https://github.com/spotify/basic-pitch-ts) (polyphonic transcription, optional)
- Web Audio API + MediaRecorder
- Anthropic SDK (AI riff generation — requires `ANTHROPIC_API_KEY`)

All audio analysis happens client-side. The only backend call is the optional AI riff generator.

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000 and grant microphone permission when prompted.

For AI riff generation, set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Deploy to Vercel

Push this repo to GitHub and import it in the Vercel dashboard, or run:

```bash
npx vercel
```

Set `ANTHROPIC_API_KEY` in the Vercel project environment variables. Vercel's HTTPS is required for microphone access.

## Features

### Core detection
- **Live microphone** — real-time monophonic YIN pitch detection (50 Hz polling)
- **Polyphonic mode** — fast chromagram for live, or Spotify Basic Pitch (TensorFlow.js) for uploads/recordings
- **Audio upload & recording** — analyze WAV, MP3, or any browser-supported format
- **Scale recognition** — 17 scale templates matched by weighted pitch-class profile
- **Chord recognition** — detects chord names from accumulated pitch-class energy
- **MIDI export** — download detected notes as a Type-0 MIDI file

### Guitar tools
- **Interactive fretboard** — 22-fret SVG with color-coded pitch classes, scale overlays, high-contrast/colorblind mode, keyboard navigation
- **6 tunings** — Standard, Drop D, half-step down, full-step down, Open G, DADGAD
- **Capo simulation** — adjustable 0–12 frets
- **Built-in tuner** — 6-string reference, configurable A4 Hz (415–466 Hz)
- **Metronome** — BPM, tap tempo

### Practice & generation
- **AI Riff Generator** — describe a song/section and Claude generates a riff with ASCII tab and tips
- **Procedural Solo Generator** — deterministic seeded solos with bends, slides, hammer-ons
- **Diatonic chord display** — shows diatonic triads in the detected scale
- **Chord progression editor** — JSON editor with 6 presets and playback
- **Solo guide** — highlights guide tones for improvisation

### UX
- Session persistence (localStorage) — notes survive page refresh
- Keyboard shortcuts: `Space` mic · `R` record · `Esc` reset
- High-contrast / colorblind mode
- Reduced-motion support

## Notes & limitations

- **Live mic is monophonic** (`pitchy`'s YIN detector). For chords, enable **Polyphonic mode** in Input settings — live still uses a fast chromagram, and for **uploads or recordings** you can switch the engine to **Basic Pitch**. Basic Pitch loads lazily on first opt-in (~1 MB model + TensorFlow.js) and runs offline.
- **Clean tone works best.** Heavy distortion and palm-muting confuse YIN.
- The riff generator calls the Anthropic API (rate-limited to 10 req/min per IP).

The `prebuild` / `predev` scripts copy Basic Pitch's model files out of `node_modules/@spotify/basic-pitch/model/` into `public/models/basic-pitch/`. The destination is gitignored — regenerated on every install + build.

## Project layout

```
app/              Next.js App Router (layout + page + api/generate-riff)
components/       React UI (Fretboard, MicControls, ScaleSuggestions, …)
lib/audio/        Web Audio hooks + offline buffer analyzer
lib/music/        Note utils, scale templates, scale/mode/chord detector
lib/guitar/       Tuning + fret-to-note mapping
lib/export/       MIDI export
```
