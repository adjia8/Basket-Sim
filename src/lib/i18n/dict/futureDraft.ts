export const keys = [
  "futureDraft.title",
  "futureDraft.link",
  "futureDraft.subtitle",
  "futureDraft.help",
  "futureDraft.none",
  "futureDraft.classTitle",
  "futureDraft.inYears",
  "futureDraft.col.player",
  "futureDraft.col.pos",
  "futureDraft.col.height",
  "futureDraft.col.age",
  "futureDraft.col.projection",
  "futureDraft.col.team",
  "futureDraft.sources",
] as const;

export type FutureDraftKey = (typeof keys)[number];

export const fr: Record<FutureDraftKey, string> = {
  "futureDraft.title": "Prospects à venir",
  "futureDraft.link": "Prospects des prochaines drafts →",
  "futureDraft.subtitle":
    "Les vrais joueurs universitaires, européens et lycéens attendus aux prochaines drafts. La note est une projection au moment de leur draft, estimée par tes recruteurs (niveau {scouting}) : plus la draft est lointaine, plus la fourchette est large.",
  "futureDraft.help":
    "Âge et note sont projetés au jour de leur draft. Au-delà des 30 premiers de chaque classe, la draft est complétée par des prospects générés.",
  "futureDraft.none": "Aucune classe de prospects réels annoncée au-delà de la prochaine draft.",
  "futureDraft.classTitle": "Draft {year}",
  "futureDraft.inYears": "(dans {count} an(s))",
  "futureDraft.col.player": "Joueur",
  "futureDraft.col.pos": "Poste",
  "futureDraft.col.height": "Taille",
  "futureDraft.col.age": "Âge",
  "futureDraft.col.projection": "Projection",
  "futureDraft.col.team": "Équipe actuelle / engagement",
  "futureDraft.sources":
    "Sources : ESPN (classement des prospects 2027, premiers regards sur les drafts 2027-2028 du 20 août 2026, classements SCNEXT des promotions de lycée 2027 et 2028), Hoops Rumors. Notes : estimations du jeu.",
};

export const en: Record<FutureDraftKey, string> = {
  "futureDraft.title": "Upcoming prospects",
  "futureDraft.link": "Prospects for upcoming drafts →",
  "futureDraft.subtitle":
    "The real college, European and high school players expected in the next drafts. The rating is a projection at draft time, estimated by your scouts (level {scouting}): the further away the draft, the wider the range.",
  "futureDraft.help":
    "Age and rating are projected to draft day. Beyond each class's top 30, the draft is filled with generated prospects.",
  "futureDraft.none": "No real prospect class announced beyond the next draft.",
  "futureDraft.classTitle": "{year} draft",
  "futureDraft.inYears": "(in {count} yr(s))",
  "futureDraft.col.player": "Player",
  "futureDraft.col.pos": "Pos",
  "futureDraft.col.height": "Height",
  "futureDraft.col.age": "Age",
  "futureDraft.col.projection": "Projection",
  "futureDraft.col.team": "Current team / commitment",
  "futureDraft.sources":
    "Sources: ESPN (2027 prospect rankings, early look at the 2027-2028 drafts from Aug 20, 2026, SCNEXT rankings of the 2027 and 2028 high school classes), Hoops Rumors. Ratings: game estimates.",
};
