"use client";

function levelColor(pct: number): string {
  if (pct >= 90) return "#ef4444";
  if (pct >= 70) return "#f59e0b";
  return "#10b981";
}

export function LevelMeter({ level }: { level: number }) {
  const pct = Math.min(100, Math.round(level * 400));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-40 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full transition-[width] duration-75 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: levelColor(pct) }}
        />
      </div>
      <span className="w-7 text-right text-[10px] tabular-nums text-zinc-500">{pct}%</span>
    </div>
  );
}
