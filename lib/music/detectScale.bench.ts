import { bench, describe } from "vitest";
import { detectScales } from "./detectScale";
import { buildProfile } from "./profile";

// Simulate a typical G major session (G A B C D E F# notes played).
const G_MAJOR_NOTES = [7, 9, 11, 0, 2, 4, 6].map((pc) => ({
  midi: 60 + pc,
  noteName: "",
  pitchClass: pc,
  frequency: 440,
  clarity: 0.95,
  at: 0,
  endAt: 500,
  durationMs: 500,
}));

const profile = buildProfile(G_MAJOR_NOTES, null);
const emptyProfile = Array(12).fill(0);
const denseProfile = Array(12).fill(100);

describe("detectScales", () => {
  bench("G major 7-note session", () => {
    detectScales(profile, 5);
  });

  bench("empty profile early-exit", () => {
    detectScales(emptyProfile, 5);
  });

  bench("uniform profile (worst case — all roots compete)", () => {
    detectScales(denseProfile, 5);
  });

  bench("topN=1 (fastest selection)", () => {
    detectScales(profile, 1);
  });

  bench("topN=10 (all results)", () => {
    detectScales(profile, 10);
  });
});
