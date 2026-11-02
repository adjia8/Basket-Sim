// Gestion manuelle de la rotation (5 majeurs, 1er remplaçant, banc) — voir
// src/app/actions/rotation.ts et src/components/team/RotationOrderForm*.tsx.
export const keys = [
  "rotation.title",
  "rotation.description",
  "rotation.activeHeading",
  "rotation.reserveHeading",
  "rotation.role.starter",
  "rotation.role.sixthWoman",
  "rotation.role.bench",
  "rotation.dragHandle",
  "rotation.addToRotation",
  "rotation.removeFromRotation",
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
    "Glisse une ligne (poignée ⠿) pour la replacer, ou utilise +/− pour la faire entrer ou sortir de la rotation active : les 5 premières lignes sont titulaires, la 6e entre en premier du banc.",
  "rotation.activeHeading": "En rotation (jouent)",
  "rotation.reserveHeading": "Hors rotation (ne jouent pas, sauf urgence)",
  "rotation.role.starter": "Titulaire",
  "rotation.role.sixthWoman": "1er remplaçant",
  "rotation.role.bench": "Banc",
  "rotation.dragHandle": "Glisser pour réordonner (ou flèches ↑/↓ au clavier)",
  "rotation.addToRotation": "Ajouter à la rotation",
  "rotation.removeFromRotation": "Retirer de la rotation",
  "rotation.save": "Enregistrer la rotation",
  "rotation.saving": "Enregistrement…",
  "rotation.saved": "Rotation enregistrée.",
  "rotation.invalidOrder": "Ordre de rotation invalide.",
  "rotation.unknownPlayer": "Cet ordre contient un nom absent de l'effectif.",
};

export const en: Record<RotationKey, string> = {
  "rotation.title": "Rotation",
  "rotation.description":
    "Drag a row (⠿ handle) to reposition it, or use +/− to move it in or out of the active rotation: the top 5 are starters, the 6th is first off the bench.",
  "rotation.activeHeading": "Active rotation (plays)",
  "rotation.reserveHeading": "Out of rotation (doesn't play unless needed)",
  "rotation.role.starter": "Starter",
  "rotation.role.sixthWoman": "First sub",
  "rotation.role.bench": "Bench",
  "rotation.dragHandle": "Drag to reorder (or ↑/↓ arrow keys)",
  "rotation.addToRotation": "Add to rotation",
  "rotation.removeFromRotation": "Remove from rotation",
  "rotation.save": "Save rotation",
  "rotation.saving": "Saving…",
  "rotation.saved": "Rotation saved.",
  "rotation.invalidOrder": "Invalid rotation order.",
  "rotation.unknownPlayer": "A player in this order isn't on the roster.",
};
