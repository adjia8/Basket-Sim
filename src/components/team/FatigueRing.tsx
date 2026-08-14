import { inverseRatingTone, toneStrokeClass } from "@/lib/color-scale";

// Jauge de fatigue en anneau (0-99, voir Player.fatigue) — haut = mauvais,
// même échelle inversée que le reste de l'UI (voir inverseRatingTone).
export function FatigueRing({ value, size = 40 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;
  const tone = inverseRatingTone(clamped);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-black/10 dark:stroke-white/10"
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        className={toneStrokeClass(tone)}
      />
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.3}
        fontWeight="600"
        className="fill-current"
      >
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}
