"use client";

type Props = {
  boxOn: boolean;
  boxCenterFret: number;
  boxWindow: number;
  onBoxOnChange: (on: boolean) => void;
  onCenterChange: (fret: number) => void;
  onWindowChange: (w: number) => void;
  numFrets: number;
  capo: number;
  onCapoChange: (n: number) => void;
};

export function FretboardControls({
  boxOn,
  boxCenterFret,
  boxWindow,
  onBoxOnChange,
  onCenterChange,
  onWindowChange,
  numFrets,
  capo,
  onCapoChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
      <label className="flex items-center gap-2">
        Capo
        <select
          className="rounded bg-zinc-800 px-2 py-1 text-zinc-100"
          value={capo}
          onChange={(e) => onCapoChange(Number(e.target.value))}
        >
          <option value={0}>None</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              Fret {n}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={boxOn}
          onChange={(e) => onBoxOnChange(e.target.checked)}
        />
        CAGED box (focus around one fret)
      </label>
      <label className={`flex items-center gap-2 ${boxOn ? "" : "opacity-50"}`}>
        Center fret
        <input
          type="range"
          min={0}
          max={numFrets}
          step={1}
          value={boxCenterFret}
          onChange={(e) => onCenterChange(Number(e.target.value))}
          disabled={!boxOn}
        />
        <span className="w-8 text-right text-zinc-200">{boxCenterFret}</span>
      </label>
      <label className={`flex items-center gap-2 ${boxOn ? "" : "opacity-50"}`}>
        Window
        <select
          className="rounded bg-zinc-800 px-2 py-1 text-zinc-100 disabled:opacity-50"
          value={boxWindow}
          onChange={(e) => onWindowChange(Number(e.target.value))}
          disabled={!boxOn}
        >
          <option value={3}>±3</option>
          <option value={4}>±4</option>
          <option value={5}>±5</option>
          <option value={6}>±6</option>
        </select>
      </label>
    </div>
  );
}
