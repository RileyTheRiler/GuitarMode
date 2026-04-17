"use client";

export function LevelMeter({ level }: { level: number }) {
  const pct = Math.min(100, Math.round(level * 400));
  return (
    <div className="h-2 w-32 overflow-hidden rounded-full bg-zinc-800">
      <div
        className="h-full bg-emerald-500 transition-[width] duration-75"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
