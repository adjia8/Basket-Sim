import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { onboardNbaTeam } from "./helpers";

// Parcours des fonctionnalités de gestion (une carrière NBA, sans simuler
// de saison) : chaque page clé s'affiche sans erreur avec ses éléments
// propres, une négociation de contrat va jusqu'à la signature, et un compte
// peut gérer plusieurs carrières. Les règles elles-mêmes sont couvertes par
// les tests unitaires (tests/unit, `npm run test:unit`).

async function expectPageOk(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByText("This page couldn’t load")).toHaveCount(0);
  // Le portail des outils de dev Next existe toujours (badge « N ») : on
  // vérifie seulement qu'il ne signale aucune erreur.
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-issues-count], [data-nextjs-dialog]")).toHaveCount(0);
}

test("pages de gestion, négociation et carrières multiples", async ({ page }) => {
  test.setTimeout(600_000);
  const prisma = new PrismaClient();
  try {
    const email = await test.step("créer une carrière NBA (Lakers)", () => onboardNbaTeam(page, /Lakers/, { tag: "features" }));
    const membership = await prisma.membership.findFirstOrThrow({ where: { user: { email } } });
    const careerId = membership.careerId;

    await test.step("pages principales", async () => {
      await expectPageOk(page, "/teams/lal");
      await expect(page.getByTestId("locker-room")).toBeVisible();
      // Aide en jeu : l'info-bulle de la cohésion s'affiche au survol.
      const tip = page.getByRole("button", { name: /Cohésion de l'équipe/ });
      await tip.hover();
      await expect(page.getByRole("tooltip").filter({ hasText: "Cohésion de l'équipe" })).toBeVisible();

      // Calendrier d'entraînement : activation puis grille de 4 semaines (lundi → dimanche).
      await expectPageOk(page, "/teams/lal?tab=training");
      const cal = page.getByTestId("training-calendar");
      await cal.locator('button[value="save"]').click();
      await expect(cal.getByText("Calendrier enregistré.")).toBeVisible({ timeout: 30_000 });
      await expect(cal.getByTestId("training-grid")).toBeVisible();
      expect(await cal.locator("select[aria-label]").count()).toBeGreaterThanOrEqual(10);

      await expectPageOk(page, "/teams/lal/players/luka-doncic");
      await expect(page.getByTestId("personality")).toBeVisible();
      await expect(page.getByTestId("progression")).toBeVisible();
      // Plan de charge : repos sur les back-to-backs, plan actif affiché.
      const plan = page.getByTestId("load-plan");
      await plan.locator('input[name="restOnBackToBacks"]').check();
      await plan.locator('button[type="submit"]').click();
      await expect(page.getByTestId("load-plan").getByText("Plan actif")).toBeVisible({ timeout: 30_000 });

      // Discussion avec un joueur : le féliciter, sa réponse s'affiche.
      const talk = page.getByTestId("player-conversation");
      await talk.locator('select[name="topic"]').selectOption("praise");
      await talk.locator('button[type="submit"]').click();
      await expect(talk.getByText("Toi")).toBeVisible({ timeout: 30_000 });

      await expectPageOk(page, "/cup");
      await expect(page.getByRole("heading", { name: "Phase de groupes" })).toBeVisible();
      await expect(page.getByText("Ouest C")).toBeVisible();

      // Calendrier mensuel (lundi → dimanche) par défaut, liste au choix.
      await expectPageOk(page, "/schedule");
      await expect(page.getByTestId("month-calendar")).toBeVisible();
      expect(await page.getByTestId("calendar-game").count()).toBeGreaterThanOrEqual(1);
      await expectPageOk(page, "/schedule?view=list");
      expect(await page.getByText("🏆").count()).toBeGreaterThanOrEqual(4); // 4 matchs de groupe de NBA Cup

      // Page Draft : mes choix pour les drafts à venir.
      await expectPageOk(page, "/draft");
      await expect(page.getByTestId("my-draft-picks")).toBeVisible();

      await expectPageOk(page, "/draft/future");
      await expect(page.getByTestId("future-class").first()).toBeVisible();
      await expect(page.getByText("Joaquim Boumtje Boumtje")).toBeVisible();

      await expectPageOk(page, "/franchise");
      await expect(page.getByTestId("finances")).toBeVisible();

      await expectPageOk(page, "/gm");
      await expect(page.getByTestId("board-objectives")).toBeVisible();

      for (const path of ["/", "/awards", "/news", "/stats", "/staff", "/free-agents", "/standings", "/inbox"]) {
        await expectPageOk(page, path);
      }

      await page.goto("/schedule");
      await page.locator('a[href^="/game/"]').first().click();
      await page.waitForURL(/\/game\//);
      await expect(page.getByTestId("scouting-report")).toBeVisible();
    });

    await test.step("boîte de réception façon FM : urgents, catégories, infos regroupées", async () => {
      const season = (await prisma.career.findUniqueOrThrow({ where: { id: careerId } })).season;
      const teamId = membership.teamId;
      const day = new Date("2026-10-20T00:00:00Z");
      const contract = await prisma.contract.findFirstOrThrow({ where: { careerId, teamId } });
      await prisma.playerState.updateMany({ where: { careerId, playerId: contract.playerId }, data: { pendingRequest: "minutes" } });
      await prisma.inboxMessage.createMany({
        data: [
          { careerId, teamId, season, type: "player_request", priority: "urgent", title: "Un joueur veut te parler", body: "Minutes.", gameDate: day, playerId: contract.playerId },
          { careerId, teamId, season, type: "injury", priority: "important", title: "Blessure test", body: "Entorse.", gameDate: day },
          ...[1, 2, 3].map((i) => ({ careerId, teamId, season, type: "standings", priority: "info", title: `Classement ${i}`, body: "…", gameDate: day })),
        ],
      });
      await expectPageOk(page, "/inbox");
      await expect(page.getByTestId("inbox-urgent")).toBeVisible();
      await expect(page.getByText("3 infos")).toBeVisible();
      // L'urgent est en tête de liste.
      await expect(page.getByTestId("inbox-row").first()).toContainText("Un joueur veut te parler");
      await page.getByTestId("inbox-row").first().click();
      await expect(page.getByTestId("inbox-message")).toContainText("Action requise");
      // Lu à l'ouverture : plus de bandeau urgent.
      await page.goto("/inbox");
      await expect(page.getByTestId("inbox-urgent")).toHaveCount(0);
      await page.getByTestId("inbox-tabs").getByRole("link", { name: /Médical/ }).click();
      await expect(page.getByTestId("inbox-row")).toHaveCount(1);
      await expect(page.getByTestId("inbox-row")).toContainText("Blessure test");
      await page.getByTestId("inbox-tabs").getByRole("link", { name: /Ligue/ }).click();
      await expect(page.getByTestId("inbox-league")).toBeVisible();
      await prisma.playerState.updateMany({ where: { careerId, playerId: contract.playerId }, data: { pendingRequest: null } });
    });

    await test.step("infirmerie de la ligue : stars blessées de toutes les équipes", async () => {
      const mine = await prisma.contract.findFirstOrThrow({ where: { careerId, teamId: membership.teamId }, orderBy: { salary: "asc" } });
      const otherStar = await prisma.playerState.findFirstOrThrow({
        where: { careerId, overallRating: { gte: 85 }, player: { contracts: { some: { careerId, teamId: { not: membership.teamId } } } } },
        orderBy: { overallRating: "desc" },
      });
      await prisma.playerState.updateMany({
        where: { careerId, playerId: otherStar.playerId },
        data: { injured: true, injuryGamesRemaining: 12, injurySeverity: "moderate", injuryType: "ankle_sprain" },
      });
      await prisma.playerState.updateMany({
        where: { careerId, playerId: mine.playerId },
        data: { injured: true, injuryGamesRemaining: 3, injurySeverity: "minor", injuryType: "illness" },
      });
      await expectPageOk(page, "/injuries");
      await expect(page.getByTestId("injury-row").first()).toContainText("Star");
      await page.getByRole("link", { name: "Mon équipe" }).last().click();
      await page.waitForURL(/view=mine/);
      await expect(page.getByTestId("injury-row")).toHaveCount(1);
      await page.getByRole("link", { name: "Tous", exact: true }).click();
      await page.waitForURL(/view=all/);
      await expect.poll(() => page.getByTestId("injury-row").count()).toBeGreaterThanOrEqual(2);
      await prisma.playerState.updateMany({
        where: { careerId, playerId: { in: [otherStar.playerId, mine.playerId] } },
        data: { injured: false, injuryGamesRemaining: 0, injurySeverity: null, injuryType: null },
      });
    });

    await test.step("rapport d'équipe : points forts / faibles, profondeur par poste", async () => {
      await expectPageOk(page, "/teams/lal?tab=report");
      await expect(page.getByTestId("team-report")).toBeVisible();
      await expect(page.getByTestId("report-depth")).toBeVisible();
      await expectPageOk(page, "/teams/bos?tab=report"); // aussi pour un adversaire
      await expect(page.getByTestId("team-report")).toBeVisible();
    });

    await test.step("rotation : suggestion de l'entraîneur adjoint", async () => {
      await expectPageOk(page, "/teams/lal?tab=rotation");
      const advice = page.getByTestId("rotation-advice");
      await expect(advice).toBeVisible();
      await advice.getByRole("button", { name: "Voir la suggestion" }).click();
      await expect(advice.getByText("Titulaire · meneur")).toBeVisible();
      await advice.getByTestId("apply-advice").click();
      await expect(advice.getByText(/Appliquée/)).toBeVisible();
      if (process.env.ADVICE_SHOT) await advice.screenshot({ path: process.env.ADVICE_SHOT });
    });

    await test.step("infrastructures : étoiles, comparaison, demande d'un joueur, chantier, livraison", async () => {
      // Les Lakers partent avec leurs installations réelles (centre
      // d'entraînement 4/5, salle 4/5) : récupération palier 2/3, loges
      // premium au maximum, fan zone palier 1/2.
      const star = await prisma.playerState.findFirstOrThrow({
        where: { careerId, player: { contracts: { some: { careerId, teamId: "lal" } } } },
        orderBy: { renown: "desc" },
        include: { player: true },
      });
      await prisma.playerState.update({
        where: { id: star.id },
        data: { pendingRequest: "facilities", requestAt: new Date("2026-10-01"), facilityRequestKey: "recovery_center", facilityRequestTier: 3 },
      });
      await expectPageOk(page, "/franchise");
      await expect(page.getByTestId("facilities")).toBeVisible();
      await expect(page.getByTestId("facility-budget")).toContainText("Investissable sans fragiliser le club");
      await expect(page.getByTestId("project-recovery_center").getByTestId("after-cash")).toContainText("Trésorerie après paiement comptant");
      await expect(page.getByTestId("facility-training-compare")).toContainText(/Ligue : \d+(er|e)( ex æquo)? sur 30/);
      expect(await page.getByTestId("project-rating").count()).toBeGreaterThanOrEqual(10);
      const card = page.getByTestId("project-recovery_center");
      await expect(card.getByTestId("project-request")).toContainText(star.player.lastName);
      await expect(card.getByText("Palier 3 :")).toBeVisible();
      // Le joueur le réclame : on le lui promet depuis sa fiche.
      await expectPageOk(page, `/teams/lal/players/${star.playerId}`);
      const talk = page.getByTestId("player-conversation");
      await expect(talk.getByText(/Centre de récupération/)).toBeVisible();
      await talk.locator('select[name="topic"]').selectOption("promise_facility");
      await talk.locator('button[type="submit"]').click();
      await expect(talk.getByText(/chantier à lancer d'ici 90 jours/)).toBeVisible({ timeout: 30_000 });
      expect((await prisma.playerState.findUniqueOrThrow({ where: { id: star.id } })).facilityPromiseBy).not.toBeNull();

      await expectPageOk(page, "/franchise");
      await expect(card.getByTestId("project-request")).toContainText("Promis à");
      await card.getByLabel(/Comptant/).check();
      await card.getByRole("button", { name: "Lancer le chantier" }).click();
      await expect(card.getByText(/Chantier lancé/)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("facility-progress").getByText(/Centre de récupération/)).toBeVisible();
      // Choix exclusif : les loges existent déjà, la tribune populaire est impossible.
      await expect(page.getByTestId("project-fan_stand").getByText(/Incompatible avec/)).toBeVisible();
      await expect(page.getByTestId("project-premium_suites").getByText("Palier maximum atteint")).toBeVisible();
      const zone = page.getByTestId("project-fan_zone");
      await zone.getByLabel(/Emprunt/).check();
      await zone.getByRole("button", { name: "Lancer le chantier" }).click();
      await expect(zone.getByText(/Chantier lancé/)).toBeVisible({ timeout: 30_000 });
      if (process.env.FACILITY_SHOT) {
        await page.reload();
        await page.getByTestId("facilities").screenshot({ path: process.env.FACILITY_SHOT });
      }
      // Livraison : on avance la date de fin des chantiers.
      const state = await prisma.teamState.findFirstOrThrow({ where: { careerId, teamId: "lal" } });
      const plan = JSON.parse(state.facilityProjectsJson!);
      for (const p of plan.projects) p.completesOn = "2000-01-01T00:00:00.000Z";
      await prisma.teamState.update({ where: { id: state.id }, data: { facilityProjectsJson: JSON.stringify(plan) } });
      await expectPageOk(page, "/franchise");
      await expect(page.getByTestId("facilities").getByText(/Récupération \+12 %/).first()).toBeVisible();
      await expect(zone.getByText("Palier maximum atteint")).toBeVisible();
      await expect(card.getByText("Palier maximum atteint")).toBeVisible();
      const after = await prisma.teamState.findFirstOrThrow({ where: { careerId, teamId: "lal" } });
      expect(after.facilitiesLevel).toBe(state.facilitiesLevel + 4);
      expect(after.publicOpinion).toBe(state.publicOpinion + 4);
      expect(await prisma.inboxMessage.count({ where: { careerId, teamId: "lal", type: "facility" } })).toBe(2);
      await expect(page.getByTestId("facility-progress").getByText(/Emprunts en cours/)).toBeVisible();
    });

    await test.step("carrière du GM : note, réputation, contrat, prolongation, train de vie", async () => {
      const gm = await prisma.gmProfile.findFirstOrThrow({ where: { membership: { careerId, teamId: "lal" } } });
      expect(gm.contractSalary).toBeGreaterThan(1_000_000); // contrat dès la création
      await prisma.gmProfile.update({
        where: { id: gm.id },
        data: { personalCash: 2_000_000, pendingExtensionJson: JSON.stringify({ salary: 5_000_000, years: 3 }) },
      });
      await expectPageOk(page, "/gm");
      await expect(page.getByTestId("gm-rating")).toBeVisible();
      await expect(page.getByTestId("gm-trend-offense")).toBeVisible();
      await expect(page.getByTestId("gm-reputation")).toContainText("Presse");
      await expect(page.getByTestId("gm-contract")).toContainText("Salaire");
      await page.getByTestId("gm-extension").getByRole("button", { name: "Signer" }).click();
      await expect(page.getByTestId("gm-extension")).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByTestId("gm-contract")).toContainText("3 saison(s) restante(s)");
      expect((await prisma.gmProfile.findUniqueOrThrow({ where: { id: gm.id } })).contractSalary).toBe(5_000_000);
      // Train de vie : acheter une maison puis la remplacer par un appartement (revente à 60 %).
      await page.getByTestId("gm-wealth").getByRole("link").click();
      await page.waitForURL(/\/gm\/lifestyle/);
      const house = page.getByTestId("lifestyle-family_house");
      await house.getByRole("button", { name: "Acheter" }).click();
      await expect(house.getByText(/c'est à toi/)).toBeVisible({ timeout: 30_000 });
      await expect(house.getByText("Possédé")).toBeVisible();
      const apt = page.getByTestId("lifestyle-apartment");
      await apt.getByRole("button", { name: "Acheter" }).click();
      await expect(apt.getByText(/c'est à toi/)).toBeVisible({ timeout: 30_000 });
      const after = await prisma.gmProfile.findUniqueOrThrow({ where: { id: gm.id } });
      expect(after.personalCash).toBe(2_000_000 - 1_200_000 + 720_000 - 450_000);
      expect(JSON.parse(after.lifestyleJson!)).toEqual(["apartment"]);
      if (process.env.GM_SHOT) {
        await page.goto("/gm");
        await page.screenshot({ path: process.env.GM_SHOT, fullPage: true });
      }
    });

    await test.step("centre des transferts : partenaires, analyse en direct, intérêt de l'IA", async () => {
      await expectPageOk(page, "/trades");
      await expect(page.getByTestId("trade-partners")).toBeVisible();
      await page.getByTestId("trade-partners").getByRole("link", { name: /Boston Celtics/ }).click();
      await page.waitForURL(/\/teams\/bos\?tab=trade/);
      const center = page.getByTestId("trade-center");
      await expect(center).toBeVisible();
      // Un joueur de chaque côté (le moins bien noté de mon effectif contre un de leurs remplaçants).
      const boxes = center.locator('input[type="checkbox"]');
      await center.locator('input[name="myPlayerIds"]').last().check();
      await center.locator('input[name="theirPlayerIds"]').last().check();
      expect(await boxes.count()).toBeGreaterThan(10);
      await expect(center.getByTestId("trade-rules")).toBeVisible({ timeout: 30_000 });
      await expect(center.getByTestId("trade-interest")).toBeVisible();
      await page.screenshot({ path: process.env.TRADE_SHOT ?? "test-results/trade-center.png", fullPage: true });
    });

    await test.step("offre reçue : détail, avis de l'adjoint, réactions fans/direction", async () => {
      // Boston propose un joueur au salaire proche contre le joueur le plus populaire des Lakers.
      const mine = await prisma.contract.findMany({ where: { careerId, teamId: "lal", contractType: "standard" } });
      const states = await prisma.playerState.findMany({ where: { careerId, playerId: { in: mine.map((c) => c.playerId) } } });
      const fav = [...states].sort((a, b) => b.renown - a.renown)[0];
      const favContract = mine.find((c) => c.playerId === fav.playerId)!;
      const theirs = await prisma.contract.findMany({ where: { careerId, teamId: "bos", contractType: "standard" } });
      const match = [...theirs].sort((a, b) => Math.abs(a.salary - favContract.salary) - Math.abs(b.salary - favContract.salary))[0];
      await prisma.tradeOffer.create({
        data: {
          careerId,
          fromTeamId: "bos",
          toTeamId: "lal",
          items: { create: [{ playerId: match.playerId, side: "from" }, { playerId: fav.playerId, side: "to" }] },
        },
      });
      const opinionBefore = (await prisma.teamState.findFirstOrThrow({ where: { careerId, teamId: "lal" } })).publicOpinion;
      await expectPageOk(page, "/trades");
      const offer = page.getByTestId("received-offer").first();
      await expect(offer.getByTestId("offer-detail")).toBeVisible();
      await expect(offer.getByTestId("offer-player")).toHaveCount(2);
      await expect(offer.getByTestId("offer-review")).toBeVisible();
      await expect(offer.getByTestId("offer-verdict")).toBeVisible();
      if (process.env.OFFER_SHOT) await offer.screenshot({ path: process.env.OFFER_SHOT });

      // Négociation : l'offre est pré-remplie ; une contre-proposition
      // déséquilibrée (mon plus mauvais joueur à la place du leur) est refusée
      // et entame la patience de Boston.
      await offer.getByTestId("negotiate-offer").click();
      await page.waitForURL(/\/teams\/bos\?tab=trade&counter=/);
      const center = page.getByTestId("trade-center");
      await expect(center.getByTestId("counter-banner")).toBeVisible();
      await expect(center.locator(`input[name="myPlayerIds"][value="${fav.playerId}"]`)).toBeChecked();
      await expect(center.locator(`input[name="theirPlayerIds"][value="${match.playerId}"]`)).toBeChecked();
      // Trop gourmand : on réclame en plus leurs trois premiers tours de draft.
      const bosFirsts = await prisma.draftPick.findMany({ where: { careerId, teamId: "bos", round: 1, status: "pending" } });
      for (const pk of bosFirsts) await center.locator(`input[name="theirPickIds"][value="${pk.id}"]`).check();
      await expect(center.getByTestId("trade-interest")).toBeVisible({ timeout: 30_000 });
      if (process.env.COUNTER_SHOT) await center.screenshot({ path: process.env.COUNTER_SHOT });
      await center.getByRole("button", { name: "Faire la contre-proposition" }).click();
      await expect(center.getByText(/Encore 2 contre-proposition/)).toBeVisible({ timeout: 30_000 });
      await expectPageOk(page, "/trades");
      await expect(offer.getByText(/Contre-propositions refusées : 1\/3/)).toBeVisible();

      await offer.getByRole("button", { name: "Accepter" }).click();
      await expect(page.getByTestId("received-offer")).toHaveCount(0, { timeout: 30_000 });
      const reaction = await prisma.inboxMessage.findFirst({ where: { careerId, teamId: "lal", type: "trade_reaction" } });
      expect(reaction?.body).toContain("Les fans");
      expect(reaction?.body).toContain("La direction");
      const opinionAfter = (await prisma.teamState.findFirstOrThrow({ where: { careerId, teamId: "lal" } })).publicOpinion;
      expect(opinionAfter).toBeLessThan(opinionBefore); // le chouchou est parti
      await expectPageOk(page, "/inbox");
      await expect(page.getByText(/Réactions à l'échange/).first()).toBeVisible();
    });

    await test.step("négociation de prolongation jusqu'à la signature", async () => {
      // Un joueur sans exigence de star (renommée < 70), en dernière année.
      const contracts = await prisma.contract.findMany({
        where: { careerId, teamId: "lal", contractType: "standard", isRookieScale: false },
      });
      const states = await prisma.playerState.findMany({ where: { careerId, playerId: { in: contracts.map((c) => c.playerId) } } });
      const target = contracts.find((c) => (states.find((s) => s.playerId === c.playerId)?.renown ?? 99) < 70)!;
      await prisma.contract.update({ where: { id: target.id }, data: { yearsRemaining: 1 } });

      await page.goto(`/teams/lal/players/${target.playerId}`);
      const panel = page.getByTestId("negotiation");
      await expect(panel).toBeVisible();
      await panel.locator('input[name="salary"]').fill("1400000");
      await panel.locator('button:has-text("Faire l\'offre")').click();
      const accept = panel.locator('form:has(input[name="mode"][value="acceptCounter"]) button');
      await expect(accept).toBeVisible({ timeout: 30_000 });
      const negotiation = await prisma.contractNegotiation.findFirstOrThrow({ where: { careerId, playerId: target.playerId } });
      await accept.click();
      await expect
        .poll(async () => (await prisma.contract.findUniqueOrThrow({ where: { id: target.id } })).salary, { timeout: 30_000 })
        .toBe(negotiation.counterSalary);
    });

    await test.step("plusieurs carrières sur un même compte", async () => {
      await onboardNbaTeam(page, /Celtics/, { email });
      await page.goto("/careers");
      await expect(page.getByTestId("career-row")).toHaveCount(2);
      // La nouvelle carrière est active ; on reprend les Lakers.
      await page.getByTestId("career-row").filter({ hasText: "Lakers" }).locator('button:has-text("Reprendre")').click();
      await page.waitForURL("/");
      await expect(page.getByText("Los Angeles Lakers").first()).toBeVisible();
      // Puis on supprime les Celtics.
      await page.goto("/careers");
      const celtics = page.getByTestId("career-row").filter({ hasText: "Celtics" });
      await celtics.locator('button:has-text("Supprimer la carrière")').click();
      await celtics.locator('button:has-text("Confirmer la suppression")').click();
      await expect(page.getByTestId("career-row")).toHaveCount(1, { timeout: 60_000 });
      expect(await prisma.membership.count({ where: { user: { email } } })).toBe(1);
    });
  } finally {
    await prisma.$disconnect();
  }
});
