# GuitarMode

Real-time guitar note & scale/mode recognition in the browser. Play a few notes into your mic (or upload / record a sample) and GuitarMode will:

- name the notes you played,
- rank likely scales & modes they fit into,
- show the remaining notes in that scale,
- and light them up on a 22-fret guitar fretboard visualization.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- [`pitchy`](https://www.npmjs.com/package/pitchy) (YIN pitch detection)
- Web Audio API + MediaRecorder

All analysis happens client-side — there is no backend.

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000 and grant microphone permission when prompted.

## Deploy to Vercel

Push this repo to GitHub and import it in the Vercel dashboard, or run:

```bash
npx vercel
```

No env vars, no config needed. Vercel's HTTPS is required for microphone access.

## Notes & limitations

- **Monophonic only.** `pitchy` is a monophonic detector; chords won't resolve cleanly. Use single-note lines.
- **Clean tone works best.** Heavy distortion and palm-muting confuse YIN.
- **Tunings.** Standard, Drop D, half-step down, full-step down, Open G, and DADGAD ship out of the box (see `lib/guitar/tunings.ts`). The fretboard, scale matcher, and built-in tuner all follow the selected tuning.

## Project layout

```
app/              Next.js App Router (layout + page + globals.css)
components/       React UI (Fretboard, MicControls, ScaleSuggestions, …)
lib/audio/        Web Audio hooks + offline buffer analyzer
lib/music/        Note utils, scale templates, scale/mode detector
lib/guitar/       Tuning + fret-to-note mapping
```
