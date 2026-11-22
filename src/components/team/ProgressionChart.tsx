import type { RatingPoint } from "@/lib/data-access/rating-history";

// Courbe de la note d'un joueur (relevés mensuels + aujourd'hui). Une seule
// échelle pour les points, les graduations et les libellés ; couleurs tirées
// des jetons du thème (lisible en clair comme en sombre).
export function ProgressionChart({
  points,
  potentialMid,
  labels,
}: {
  points: RatingPoint[];
  potentialMid: number | null;
  labels: { potential: string; today: string };
}) {
  const W = 640;
  const H = 180;
  const pad = { l: 34, r: 14, t: 14, b: 30 };
  const values = points.map((p) => p.overall);
  const lo = Math.floor(Math.min(...values, potentialMid ?? Infinity) / 5) * 5 - 5;
  const hi = Math.ceil(Math.max(...values, potentialMid ?? -Infinity) / 5) * 5 + 5;
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  // Libellé de saison sous le premier relevé de chaque saison.
  const seasonStarts = points.map((p, i) => (i === 0 || points[i - 1].season !== p.season ? i : -1)).filter((i) => i >= 0);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.overall).toFixed(1)}`).join(" ");
  const last = points.length - 1;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[320px]" role="img" aria-label="Progression">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="stroke-line-soft" strokeWidth={1} />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="fill-faint text-2xs">
              {v}
            </text>
          </g>
        ))}
        {potentialMid !== null && (
          <g>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(potentialMid)}
              y2={y(potentialMid)}
              className="stroke-info"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <text x={W - pad.r} y={y(potentialMid) - 5} textAnchor="end" className="fill-info text-2xs">
              {labels.potential} ≈ {potentialMid}
            </text>
          </g>
        )}
        <path d={path} fill="none" className="stroke-accent" strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.overall)} r={i === last ? 4.5 : 3} className={i === last ? "fill-accent" : "fill-surface stroke-accent"} strokeWidth={2} />
        ))}
        <text x={x(last)} y={y(points[last].overall) - 10} textAnchor="middle" className="fill-fg text-[12px] font-semibold">
          {points[last].overall}
        </text>
        {seasonStarts.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : "middle"} className="fill-muted text-2xs">
            {points[i].season}
          </text>
        ))}
      </svg>
    </div>
  );
}
