// Gestion manuelle de la rotation (5 majeures, 6ème femme, banc) — voir
// src/app/actions/rotation.ts et src/components/team/RotationOrderForm*.tsx.
export const keys = [
  "rotation.title",
  "rotation.description",
  "rotation.role.starter",
  "rotation.role.sixthWoman",
  "rotation.role.bench",
  "rotation.role.outOfRotation",
  "rotation.dragHandle",
  "rotation.save",
  "rotation.saving",
  "rotation.saved",
  "rotation.invalidOrder",
  "rotation.unknownPlayer",
] as const;

export type RotationKey = (typeof keys)[number];

export const fr: Record<RotationKey, string> = {
  "rotation.title": "Rotation",
  "rotation.description":
    "Fais glisser une joueuse (poignée ⠿) pour la replacer : les 5 premières sont titulaires, la 6ème entre en premier du banc. Au-delà de la 10ème, une joueuse ne joue que si assez de titulaires/banc sortent (fautes, blessures).",
  "rotation.role.starter": "Titulaire",
  "rotation.role.sixthWoman": "6ème femme",
  "rotation.role.bench": "Banc",
  "rotation.role.outOfRotation": "Hors rotation",
  "rotation.dragHandle": "Glisser pour réordonner (ou flèches ↑/↓ au clavier)",
  "rotation.save": "Enregistrer la rotation",
  "rotation.saving": "Enregistrement…",
  "rotation.saved": "Rotation enregistrée.",
  "rotation.invalidOrder": "Ordre de rotation invalide.",
  "rotation.unknownPlayer": "Une joueuse de cet ordre ne fait pas partie de l'effectif.",
};

export const en: Record<RotationKey, string> = {
  "rotation.title": "Rotation",
  "rotation.description":
    "Drag a player (⠿ handle) to reposition her: the top 5 are starters, the 6th is first off the bench. Beyond 10th, a player only sees the floor if enough starters/bench players are out (fouls, injuries).",
  "rotation.role.starter": "Starter",
  "rotation.role.sixthWoman": "Sixth woman",
  "rotation.role.bench": "Bench",
  "rotation.role.outOfRotation": "Out of rotation",
  "rotation.dragHandle": "Drag to reorder (or ↑/↓ arrow keys)",
  "rotation.save": "Save rotation",
  "rotation.saving": "Saving…",
  "rotation.saved": "Rotation saved.",
  "rotation.invalidOrder": "Invalid rotation order.",
  "rotation.unknownPlayer": "A player in this order isn't on the roster.",
};
