export const keys = [
  "help.chemistry",
  "help.morale",
  "help.renown",
  "help.potential",
  "help.personality",
  "help.status",
  "help.marketValue",
  "help.patience",
  "help.wear",
  "help.boardObjectives",
  "help.lockerRoom",
  "help.cup",
] as const;

export type HelpKey = (typeof keys)[number];

export const fr: Record<HelpKey, string> = {
  "help.chemistry":
    "Cohésion de l'équipe (0-99). Elle monte avec les victoires, le QI basket de l'effectif et les leaders du vestiaire, et donne jusqu'à ±5 % de force en match.",
  "help.morale":
    "Moral du joueur (0-99). Il bouge avec les résultats, le temps de jeu par rapport à son statut, la presse et tes promesses. Très bas, le joueur demande à partir.",
  "help.renown":
    "Renommée (0-99) : sa notoriété. Elle augmente ses exigences salariales et, au-delà de 70, il veut aussi une équipe compétitive, un marché attractif et de bonnes installations.",
  "help.potential":
    "Potentiel estimé : la note qu'il peut atteindre. Plus tes recruteurs (ou, pour tes joueurs, ton staff de développement) sont bons, plus la fourchette est étroite.",
  "help.personality":
    "Cinq traits cachés (professionnalisme, ambition, loyauté, sang-froid, leadership). Ils jouent sur sa progression, son moral, ses fautes techniques, ses exigences de contrat et le vestiaire.",
  "help.status":
    "Statut dans l'effectif (franchise, star, titulaire, rotation, espoir, fin de banc), selon sa note, son rang et sa renommée. Il fixe le temps de jeu qu'il attend : nettement moins, et son moral baisse.",
  "help.marketValue":
    "Valeur marchande : 60 % sa note, 40 % sa production réelle de la saison (à partir de 10 matchs). C'est elle qui fixe ce que demande son agent.",
  "help.patience":
    "Chaque contre-proposition use la patience de l'agent, une offre très basse deux fois plus. À zéro, il claque la porte pendant 10 jours.",
  "help.wear":
    "Usure : la fatigue accumulée sur la durée (minutes, matchs rapprochés, entraînement intense). Elle augmente le risque de blessure ; le repos la fait baisser.",
  "help.boardObjectives":
    "Fixés par la direction après 15 matchs, jugés en fin de saison régulière : +6 de confiance par objectif tenu, −8 par objectif manqué. Cette confiance compte dans ton évaluation.",
  "help.lockerRoom":
    "Les leaders (leadership 16+) tirent la cohésion vers le haut, les perturbateurs (sanguins et peu professionnels) la font baisser. Un vétéran mentor fait progresser les jeunes plus vite.",
  "help.cup":
    "Tournoi de début de saison : 4 matchs de groupe (qui comptent au classement), puis élimination directe pour les 3 premiers de groupe et le meilleur deuxième de chaque conférence.",
};

export const en: Record<HelpKey, string> = {
  "help.chemistry":
    "Team chemistry (0-99). It rises with wins, the roster's basketball IQ and locker-room leaders, and is worth up to ±5% of in-game strength.",
  "help.morale":
    "Player morale (0-99). It moves with results, playing time versus his role, the press and your promises. Very low, he asks to be traded.",
  "help.renown":
    "Renown (0-99): how famous he is. It raises his salary demands and, above 70, he also wants a competitive team, an attractive market and good facilities.",
  "help.potential":
    "Estimated potential: the rating he can reach. The better your scouts (or, for your own players, your development staff), the narrower the range.",
  "help.personality":
    "Five hidden traits (professionalism, ambition, loyalty, composure, leadership). They affect development, morale, technical fouls, contract demands and the locker room.",
  "help.status":
    "Role in the roster (franchise, star, starter, rotation, prospect, end of bench), from his rating, rank and renown. It sets the minutes he expects: well below that, his morale drops.",
  "help.marketValue":
    "Market value: 60% his rating, 40% his real production this season (from 10 games). It sets what his agent asks for.",
  "help.patience":
    "Each counter-offer wears down the agent's patience, a very low offer twice as much. At zero he walks away for 10 days.",
  "help.wear":
    "Wear: long-term fatigue (minutes, back-to-backs, hard training). It raises injury risk; rest brings it down.",
  "help.boardObjectives":
    "Set by ownership after 15 games, judged at the end of the regular season: +6 trust per goal met, −8 per goal missed. That trust counts in your review.",
  "help.lockerRoom":
    "Leaders (leadership 16+) lift chemistry, disruptive players (fiery and unprofessional) drag it down. A veteran mentor helps young players develop faster.",
  "help.cup":
    "Early-season tournament: 4 group games (they count in the standings), then single elimination for the 3 group winners and the best runner-up in each conference.",
};
