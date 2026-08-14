import { ratingTone, toneStrokeClass } from "@/lib/color-scale";

// Jauge d'énergie en anneau — inverse de Player.fatigue (0-99, haut =
// épuisée) : l'anneau se remplit et devient vert quand la joueuse est
// fraîche, se vide et devient rouge à mesure qu'elle s'épuise (jauge
// d'essence/batterie, pas un "cadran de dégâts accumulés").
export function EnergyRing({ fatigue, size = 40 }: { fatigue: number; size?: number }) {
  const clampedFatigue = Math.max(0, Math.min(100, fatigue));
  const energy = 100 - clampedFatigue;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - energy / 100);
  const center = size / 2;
  const tone = ratingTone(energy);

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
        {Math.round(energy)}%
      </text>
    </svg>
  );
}
