// Les deux couleurs principales de la franchise (Team.primaryColor/
// secondaryColor) — petit repère visuel réutilisé partout où l'identité de
// l'équipe gérée doit être rappelée (NavBar, dashboard, page effectif).
export function TeamColorSwatch({
  primaryColor,
  secondaryColor,
  size = "sm",
}: {
  primaryColor: string;
  secondaryColor: string;
  size?: "sm" | "lg";
}) {
  const dimension = size === "lg" ? "h-4 w-4" : "h-3 w-3";
  return (
    <span className="inline-flex shrink-0" title="Couleurs de la franchise">
      <span className={`${dimension} rounded-full`} style={{ backgroundColor: primaryColor }} />
      <span className={`${dimension} -ml-1 rounded-full`} style={{ backgroundColor: secondaryColor }} />
    </span>
  );
}
