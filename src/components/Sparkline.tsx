export default function Sparkline({ points, tone = "#8b6dff", height = 44, width = 220 }: { points: number[]; tone?: string; height?: number; width?: number }) {
  if (!points.length) return null;
  const max = Math.max(...points), min = Math.min(...points);
  const span = max - min || 1;
  const step = width / Math.max(1, points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(height - ((p - min) / span) * (height - 6) - 3).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const lx = (points.length - 1) * step;
  const ly = height - ((last - min) / span) * (height - 6) - 3;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={d} fill="none" stroke={tone} strokeWidth="1.6" />
      <circle cx={lx} cy={ly} r="2.6" fill={tone} />
    </svg>
  );
}
