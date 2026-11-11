// Étoiles façon Football Manager (0,5 à 5, par demi-étoile).
export function Stars({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="tracking-tight text-accent-text" aria-label={`${value}/5`} title={`${value}/5`}>
      {"★".repeat(full)}
      {half && <span className="relative inline-block">
        <span className="text-faint">★</span>
        <span className="absolute inset-0 w-1/2 overflow-hidden">★</span>
      </span>}
      <span className="text-faint">{"★".repeat(5 - full - (half ? 1 : 0))}</span>
    </span>
  );
}
