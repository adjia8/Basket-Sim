import "server-only";
import type { FranchiseCarouselLabels } from "@/components/onboarding/FranchiseCarousel";
import type { Translator } from "./translate";

// Bundle partagé par les 3 points d'entrée qui rendent FranchiseCarousel
// (création, rejoindre par code, réaffectation après licenciement) — évite
// de dupliquer cette liste de t() dans chaque page appelante.
export function franchiseCarouselLabels(t: Translator): FranchiseCarouselLabels {
  return {
    noneAvailable: t("franchise.noneAvailable"),
    objectivePrefix: t("franchise.objectivePrefix"),
    alreadyTakenPrefix: t("franchise.alreadyTakenPrefix"),
    treasury: t("franchise.treasury"),
    roster: t("franchise.roster"),
    playersUnit: t("franchise.playersUnit"),
    avgOverallSuffix: t("franchise.avgOverallSuffix"),
    facilities: t("franchise.facilities"),
    trainingStaff: t("franchise.trainingStaff"),
    topPlayers: t("franchise.topPlayers"),
    draftPicksHeading: t("franchise.draftPicksHeading"),
    pickNumberPrefix: t("franchise.pickNumberPrefix"),
    pickRoundPrefix: t("franchise.pickRoundPrefix"),
    previous: t("franchise.previous"),
    next: t("franchise.next"),
    chooseThis: t("franchise.chooseThis"),
    confirm: t("franchise.confirm"),
    createGm: t("franchise.createGm"),
    firstName: t("franchise.firstName"),
    lastName: t("franchise.lastName"),
    age: t("franchise.age"),
    sex: t("franchise.sex"),
    pointsAllocationPrefix: t("franchise.pointsAllocationPrefix"),
    pointsDescription: t("franchise.pointsDescription"),
    changeFranchise: t("franchise.changeFranchise"),
    takeCommand: t("franchise.takeCommand"),
    expectationTier: {
      rebuild: t("domain.expectationTier.rebuild"),
      play_in: t("domain.expectationTier.play_in"),
      playoffs: t("domain.expectationTier.playoffs"),
      conf_semis: t("domain.expectationTier.conf_semis"),
      conf_finals: t("domain.expectationTier.conf_finals"),
      nba_finals: t("domain.expectationTier.nba_finals"),
      champion: t("domain.expectationTier.champion"),
    },
    sexOptions: [
      { value: "M", label: t("franchise.sexMale") },
      { value: "F", label: t("franchise.sexFemale") },
      { value: "autre", label: t("franchise.sexOther") },
    ],
    gmCategories: [
      { key: "offense", label: t("franchise.catOffense") },
      { key: "defense", label: t("franchise.catDefense") },
      { key: "physical", label: t("franchise.catPhysical") },
      { key: "tactical", label: t("franchise.catTactical") },
      { key: "chemistry", label: t("franchise.catChemistry") },
    ],
  };
}
