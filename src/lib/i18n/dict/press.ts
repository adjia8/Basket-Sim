export const keys = [
  "pressPage.title",
  "pressPage.morale",
  "pressPage.publicOpinion",
  "pressPage.pendingHeading",
  "pressPage.noPending",
  "pressPage.answer",
  "pressPage.historyHeading",
  "pressPage.noHistory",
  "pressPage.categoryResults",
  "pressPage.categoryRoster",
  "pressPage.categoryManagement",
  "pressPage.categoryFuture",
] as const;

export type PressKey = (typeof keys)[number];

export const fr: Record<PressKey, string> = {
  "pressPage.title": "Conférences de presse",
  "pressPage.morale": "Moral",
  "pressPage.publicOpinion": "Opinion publique",
  "pressPage.pendingHeading": "Conférence en attente",
  "pressPage.noPending": "Aucune conférence en attente pour l'instant.",
  "pressPage.answer": "Répondre",
  "pressPage.historyHeading": "Historique",
  "pressPage.noHistory": "Aucune conférence passée pour l'instant.",
  "pressPage.categoryResults": "Résultats",
  "pressPage.categoryRoster": "Effectif",
  "pressPage.categoryManagement": "Direction",
  "pressPage.categoryFuture": "Avenir",
};

export const en: Record<PressKey, string> = {
  "pressPage.title": "Press Conferences",
  "pressPage.morale": "Morale",
  "pressPage.publicOpinion": "Public Opinion",
  "pressPage.pendingHeading": "Pending conference",
  "pressPage.noPending": "No pending conference right now.",
  "pressPage.answer": "Answer",
  "pressPage.historyHeading": "History",
  "pressPage.noHistory": "No past conferences yet.",
  "pressPage.categoryResults": "Results",
  "pressPage.categoryRoster": "Roster",
  "pressPage.categoryManagement": "Management",
  "pressPage.categoryFuture": "Future",
};
