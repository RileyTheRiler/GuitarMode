export type SheetChord = {
  symbol: string;
  beats?: number;
};

export type SheetNote = {
  noteName: string;
  midi: number;
  beats?: number;
};

export type SheetSection = {
  name: string;
  chords: string;
};

export type SheetAnalysis = {
  title: string;
  artist: string;
  key: string;
  bpm?: number;
  timeSignature?: string;
  chordsText: string;
  notes: SheetNote[];
  sections?: SheetSection[];
  notesSummary?: string;
};
