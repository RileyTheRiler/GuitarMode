# GuitarMode — Improvements & Enhancements

A prioritized backlog of improvements and enhancements for the GuitarMode project, organized by impact area.

---

## Priority 1 — High-Impact Features

### 1. Alternate Tuning Support
The fretboard is hardcoded to standard tuning (E-A-D-G-B-E). Infrastructure is already in place — `STANDARD_TUNING` is a single constant in `lib/guitar/fretboard.ts` and `getNoteAt()` is a pure function.

**Scope:**
- Add a tuning preset selector to `InputSettings` (Drop D, Open G, Open D, DADGAD, custom)
- Pass the selected tuning down to `Fretboard` and `FretboardControls`
- Recalculate fret positions whenever tuning changes
- Persist selected tuning to localStorage alongside other detector config

**Files:** `lib/guitar/fretboard.ts`, `components/Fretboard.tsx`, `components/InputSettings.tsx`, `app/page.tsx`

---

### 2. Automatic Chord Detection from Detected Notes
Chords must currently be entered manually as JSON. The building blocks already exist: `chordPitchClasses()` and `parseChord()` are in `lib/music/chords.ts`, and the pitch-class profile is already computed.

**Scope:**
- Add `detectChord(profile, topN)` to `lib/music/` using existing chord quality templates
- Display top chord candidates in a `ChordSuggestions` panel (similar layout to `ScaleSuggestions`)
- Wire into `app/page.tsx` alongside the existing `detectScales` call

**Files:** `lib/music/chords.ts` → new `lib/music/detectChord.ts`, `app/page.tsx`, new `components/ChordSuggestions.tsx`

---

### 3. MIDI Export of Detected Notes
Users want to transfer their detected session into a DAW. Notes already carry MIDI note numbers and millisecond timestamps — a minimal Type-0 MIDI file needs no external library.

**Scope:**
- Add `lib/export/midi.ts` — pure function `notesToMidi(notes: DetectedNote[]): Uint8Array`
- Add "Export MIDI" button to `MicControls`
- Download via `URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }))`

**Files:** new `lib/export/midi.ts`, `components/MicControls.tsx`

---

### 4. Chord Progression Suggestions (Roman Numeral Analysis)
Once a scale is detected, offer diatonic chord progression presets (I–IV–V–I, ii–V–I, 12-bar blues, etc.) so users don't need to know music theory to fill the `ProgressionEditor`.

**Scope:**
- Add `lib/music/progressionSuggestions.ts` with diatonic chord tables per scale template
- Display clickable progression presets in `ScaleSuggestions` when a scale is selected
- Clicking a preset loads it into `ProgressionEditor`

**Files:** new `lib/music/progressionSuggestions.ts`, `components/ScaleSuggestions.tsx`, `components/ProgressionEditor.tsx`

---

## Priority 2 — Audio & Detection Quality

### 5. Customizable Timbre Reference Samples
The three reference samples in `TimbreVisualizer` (neck warm, bridge bright, acoustic balanced) are hardcoded and won't match every guitar. Users should be able to record their own reference tone.

**Scope:**
- Add a "Record Reference" button in `TimbreVisualizer` that captures ~2 seconds of audio
- Serialize the harmonic envelope to localStorage and restore it on reload
- Fall back to the built-in samples when no custom reference exists

**Files:** `lib/audio/timbre.ts`, `components/TimbreVisualizer.tsx`

---

### 6. Normalize Chroma Accumulation by Duration
The chromagram accumulates raw frame contributions without dividing by total frame count. Long sessions inflate chroma values, causing scale matching to over-weight notes played late in a session.

**Scope:**
- Track cumulative frame count alongside `chromaProfileRef` in `usePitchDetector`
- Normalize in `buildProfile()` by frame count before passing to `detectScales`

**Files:** `lib/audio/usePitchDetector.ts`, `lib/music/profile.ts`

---

### 7. Debounce localStorage Writes
Slider and input changes write to localStorage on every React render cycle — unnecessary I/O that will be noticeable on low-end devices.

**Scope:**
- Add a small `useDebouncedPersist` hook (or inline `setTimeout` ref cleanup)
- Apply to config saves in `usePitchDetector` and `useMetronome`

**Files:** `lib/audio/usePitchDetector.ts`, `lib/audio/useMetronome.ts`

---

### 8. Scale Popularity Prior
The scoring algorithm can rank exotic scales (e.g., Hungarian Minor) above Major/Minor when evidence is thin. Adding a small popularity weight prevents false positives on simple playing.

**Scope:**
- Add an optional `popularity?: number` field to `ScaleTemplate` in `lib/music/scales.ts`
- Apply a small additive bonus (e.g., 0.1 for major/minor/pentatonic) in `detectScales`

**Files:** `lib/music/scales.ts`, `lib/music/detectScale.ts`

---

### 9. Sampled Metronome Click Sounds
The synthesized sine-burst metronome click is harsh. A short wood-block or click-track sample would be far more musical and easier to hear while playing.

**Scope:**
- Add two short audio samples to `public/` (accent click + normal click, ≤ 50 KB each)
- Load them as `AudioBuffer` in `useMetronome`
- Add a UI toggle to switch between synthesized and sampled mode

**Files:** `lib/audio/useMetronome.ts`, `public/` (new audio files), `components/Metronome.tsx`

---

## Priority 3 — UX & Polish

### 10. Dark / Light Theme Toggle
The UI is hardcoded dark. Users in bright environments benefit from a light mode, and some users simply prefer it.

**Scope:**
- Move color tokens to CSS custom properties in `app/globals.css`
- Add `data-theme` to `<html>` in `app/layout.tsx`
- Add a sun/moon toggle button in the header; persist preference to localStorage

**Files:** `app/layout.tsx`, `app/globals.css`, `app/page.tsx`

---

### 11. Keyboard Shortcuts
Power users want hands-free control while actively playing guitar. All the toggle actions are simple boolean state flips.

**Shortcut map:**
| Key | Action |
|-----|--------|
| `Space` | Toggle mic on/off |
| `R` | Start/stop recording |
| `M` | Toggle metronome |
| `Escape` | Reset all detected notes |

**Scope:**
- Add `lib/useKeyboard.ts` hook that registers `keydown` listeners and maps keys to callbacks
- Mount in `app/page.tsx`; display shortcut hints in button `title` tooltips

**Files:** new `lib/useKeyboard.ts`, `app/page.tsx`, `components/MicControls.tsx`

---

### 12. Preset Chord Progressions
The `ProgressionEditor` JSON textarea is intimidating for users without a development background. A preset dropdown lowers the barrier to entry significantly.

**Scope:**
- Add a `<select>` dropdown with 6–8 common presets (12-bar blues, I–IV–V–I, ii–V–I, Andalusian cadence, etc.)
- Selecting a preset populates the textarea; the user can still edit freely afterward

**Files:** `components/ProgressionEditor.tsx`

---

### 13. Copy Scale Info to Clipboard
Users want to share or note down the detected scale. A single copy button per row in `ScaleSuggestions` removes friction.

**Scope:**
- Add a copy icon button next to each scale match
- Copy human-readable text: `"G Dorian — confidence 87% — notes: G A Bb C D E F"`
- Show a brief "Copied!" confirmation toast

**Files:** `components/ScaleSuggestions.tsx`

---

### 14. Reduce Motion Support
The pulsing `animate-ping` animation on the currently-playing note circle can trigger vestibular issues for some users.

**Scope:**
- Check `window.matchMedia('(prefers-reduced-motion: reduce)')` and omit the pulsing class when true
- Add a "Reduce animations" toggle to `InputSettings` for manual override

**Files:** `components/Fretboard.tsx`, `components/InputSettings.tsx`

---

### 15. Chord Progression Import / Export
Users want to save progressions between sessions and share them with others. The data structure is already serializable JSON.

**Scope:**
- "Export" button downloads current progression as a `.json` file
- "Import" button accepts a `.json` file upload and validates it against the `ChordEvent` schema
- Reuse existing `parseChord` for validation

**Files:** `components/ProgressionEditor.tsx`

---

## Priority 4 — Accessibility

### 16. ARIA Live Regions for Real-Time Feedback
Screen reader users receive no feedback when notes are detected. ARIA live regions require only a few attribute additions.

**Scope:**
- Add `role="status" aria-live="polite"` container in `DetectedNotes` that announces new note names
- Add `aria-live="assertive"` for error messages in `MicControls`

**Files:** `components/DetectedNotes.tsx`, `components/MicControls.tsx`

---

### 17. Form Label Associations in InputSettings
`<label>` elements in `InputSettings` are missing `htmlFor` attributes; inputs are missing matching `id` attributes. Screen readers cannot associate them.

**Scope:**
- Add `id` to every `<input>` and `<select>` in `InputSettings`
- Add matching `htmlFor` to their `<label>` elements

**Files:** `components/InputSettings.tsx`

---

### 18. High-Contrast / Colorblind Mode
Pitch-class colors are the only differentiator for note identity on the fretboard. Users with color vision deficiency need an alternative.

**Scope:**
- Add SVG pattern fills (hatching, dots) to note circles in `Fretboard` as secondary encoding
- Activate automatically via `prefers-contrast: more` or via a toggle in `InputSettings`

**Files:** `components/Fretboard.tsx`, `components/InputSettings.tsx`, `app/globals.css`

---

### 19. Keyboard Navigation for Fretboard
Fretboard positions are currently click-only; they are not reachable via Tab key.

**Scope:**
- Add `tabIndex={0}` and `onKeyDown` (Enter or Space to audition) to the hit-target `<rect>` elements
- Add `aria-label` with note name and fret position to each interactive element

**Files:** `components/Fretboard.tsx`

---

## Priority 5 — Testing & Code Health

### 20. React Component Integration Tests
No component tests exist. Refactors could silently break rendering without detection.

**Scope:**
- Add `@testing-library/react` to devDependencies
- Write tests for `ScaleSuggestions` (renders confidence bars, handles empty state), `DetectedNotes` (delete interaction), and `Fretboard` (renders correct note circles)
- Target `components/*.test.tsx`

**Files:** new `components/ScaleSuggestions.test.tsx`, `components/DetectedNotes.test.tsx`, `components/Fretboard.test.tsx`

---

### 21. Remove WaveformPlayer Dead Code
`startPlayback` is defined in `WaveformPlayer` but never called — `handlePlay` is the actual play handler. The dead function creates confusion.

**Scope:**
- Delete the unused `startPlayback` function
- Confirm `handlePlay` covers all playback scenarios

**Files:** `components/WaveformPlayer.tsx`

---

### 22. Performance Benchmarks
No benchmarks exist to detect regressions in the two most compute-intensive paths.

**Scope:**
- Add `vitest bench` benchmarks for `detectScales()` (target: < 1 ms) and `analyzeBuffer()` for a 30-second buffer (target: < 50 ms)
- Run in CI on each pull request

**Files:** new `lib/music/detectScale.bench.ts`, `lib/audio/analyzeBuffer.bench.ts`

---

### 23. ProgressionEditor JSON Size Guard
There is no limit on the size of the JSON progression payload. A very large array could cause the browser to freeze during parsing or rendering.

**Scope:**
- Validate that `progression.length <= 500` after parsing
- Display an inline warning and reject the payload if the limit is exceeded

**Files:** `components/ProgressionEditor.tsx`

---

## Summary Table

| # | Enhancement | Priority | Effort |
|---|-------------|----------|--------|
| 1 | Alternate tuning support | High | Medium |
| 2 | Automatic chord detection | High | Medium |
| 3 | MIDI export | High | Small |
| 4 | Chord progression suggestions | High | Medium |
| 5 | Customizable timbre samples | Medium | Medium |
| 6 | Normalize chroma accumulation | Medium | Small |
| 7 | Debounce localStorage writes | Medium | Small |
| 8 | Scale popularity prior | Medium | Small |
| 9 | Sampled metronome clicks | Medium | Small |
| 10 | Dark / light theme toggle | Medium | Medium |
| 11 | Keyboard shortcuts | Medium | Small |
| 12 | Preset chord progressions | Medium | Small |
| 13 | Copy scale info to clipboard | Low | Small |
| 14 | Reduce motion support | Low | Small |
| 15 | Progression import / export | Low | Small |
| 16 | ARIA live regions | High | Small |
| 17 | Form label associations | High | Small |
| 18 | High-contrast / colorblind mode | Medium | Medium |
| 19 | Keyboard navigation (fretboard) | Medium | Small |
| 20 | Component integration tests | High | Large |
| 21 | Remove WaveformPlayer dead code | Low | Small |
| 22 | Performance benchmarks | Medium | Small |
| 23 | ProgressionEditor size guard | Medium | Small |
