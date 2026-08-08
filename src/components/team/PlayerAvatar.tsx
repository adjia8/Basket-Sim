// Pas de vraies photos disponibles : avatar généré (cercle coloré +
// initiales), couleur dérivée d'un hash déterministe de l'id joueur — même
// joueur → même couleur à chaque rendu.
const PALETTE = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-pink-500",
  "bg-rose-500",
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function PlayerAvatar({
  playerId,
  firstName,
  lastName,
  size = "sm",
}: {
  playerId: string;
  firstName: string;
  lastName: string;
  size?: "sm" | "lg";
}) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const dimension = size === "lg" ? "h-16 w-16 text-xl" : "h-8 w-8 text-xs";
  return (
    <span
      className={`inline-flex ${dimension} shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorFor(playerId)}`}
    >
      {initials}
    </span>
  );
}
