export const keys = [
  "protocol.title",
  "protocol.hint",
  "protocol.current",
  "protocol.choose",
  "protocol.standard",
  "protocol.standard.desc",
  "protocol.progressive",
  "protocol.progressive.desc",
  "protocol.rushed",
  "protocol.rushed.desc",
  "protocol.active.progressive",
  "protocol.active.rushed",
] as const;

export type ProtocolKey = (typeof keys)[number];

export const fr: Record<ProtocolKey, string> = {
  "protocol.title": "Plan de retour",
  "protocol.hint": "Proposé par ton staff médical. Le retour accéléré ne peut être choisi qu'une fois par blessure.",
  "protocol.current": "Choisi",
  "protocol.choose": "Choisir",
  "protocol.standard": "Standard",
  "protocol.standard.desc": "Retour une fois guéri, sans précaution particulière.",
  "protocol.progressive": "Progressif",
  "protocol.progressive.desc": "Au retour : 20 min maximum pendant 4 matchs, risque de rechute divisé par deux.",
  "protocol.rushed": "Accéléré",
  "protocol.rushed.desc": "Retour environ 30 % plus tôt, mais risque de rechute multiplié par 2,5 pendant 5 matchs, et une rechute serait plus grave.",
  "protocol.active.progressive": "Retour progressif : 20 min maximum, encore {count} match(s).",
  "protocol.active.rushed": "Retour accéléré : risque de rechute élevé, encore {count} match(s).",
};

export const en: Record<ProtocolKey, string> = {
  "protocol.title": "Return plan",
  "protocol.hint": "Proposed by your medical staff. A rushed return can only be chosen once per injury.",
  "protocol.current": "Selected",
  "protocol.choose": "Choose",
  "protocol.standard": "Standard",
  "protocol.standard.desc": "Returns once healed, no special precautions.",
  "protocol.progressive": "Gradual",
  "protocol.progressive.desc": "On return: 20 min max for 4 games, half the risk of re-injury.",
  "protocol.rushed": "Rushed",
  "protocol.rushed.desc": "Back about 30% sooner, but 2.5x the re-injury risk for 5 games, and a relapse would be worse.",
  "protocol.active.progressive": "Gradual return: 20 min max, {count} more game(s).",
  "protocol.active.rushed": "Rushed return: high re-injury risk, {count} more game(s).",
};
