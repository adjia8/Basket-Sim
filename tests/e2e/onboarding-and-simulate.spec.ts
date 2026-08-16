import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { registerAndOnboardWnbaTeam } from "./helpers";

// Parcours critique #1 : une carrière fraîchement créée doit pouvoir aller
// jusqu'au bout d'un match simulé, avec un box score interne cohérent —
// c'est exactement la classe de bug (point clutch non attribué à une
// joueuse) trouvée et corrigée manuellement plus tôt dans ce projet ;
// avoir un test committé évite qu'elle revienne sans être remarquée.
test("onboarding through a simulated game produces a consistent box score", async ({ page }) => {
  await registerAndOnboardWnbaTeam(page, "sim");

  await expect(page.locator("h1")).not.toBeEmpty();

  await page.goto("/schedule");
  await page.waitForSelector('a[href^="/game/"]');
  const gameHref = await page.locator('a[href^="/game/"]').first().getAttribute("href");
  expect(gameHref).toBeTruthy();

  await page.goto(gameHref!);
  await expect(page.locator('button:has-text("Simuler le match")')).toBeVisible({ timeout: 10_000 });

  // L'aperçu pré-match doit montrer les deux effectifs (voir
  // GameRosterPreview) avant même de simuler.
  const rosterTables = page.locator("table");
  await expect(rosterTables).toHaveCount(2);

  await page.click('button:has-text("Simuler le match")');
  // La route simulate-game enchaîne beaucoup de requêtes séquentielles
  // (rosters, standings, chimie, fatigue, conférence de presse, demandes de
  // trade...) — sous latence Neon, ça peut dépasser 20s (voir README.md).
  await expect(page.locator("text=Box score")).toBeVisible({ timeout: 60_000 });

  const gameId = gameHref!.split("/").pop()!;
  const prisma = new PrismaClient();
  try {
    const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });
    expect(game.status).toBe("final");
    expect(game.homeScore).not.toBeNull();
    expect(game.awayScore).not.toBeNull();

    const boxScore = JSON.parse(game.boxScore!) as {
      teamId: string;
      points: number;
      fieldGoalsMade: number;
      fieldGoalsAttempted: number;
      minutesPlayed: number;
    }[];
    expect(boxScore.length).toBeGreaterThan(0);

    const homePoints = boxScore
      .filter((e) => e.teamId === game.homeTeamId)
      .reduce((sum, e) => sum + e.points, 0);
    const awayPoints = boxScore
      .filter((e) => e.teamId === game.awayTeamId)
      .reduce((sum, e) => sum + e.points, 0);

    // Invariant central du moteur : la somme des points du box score doit
    // toujours égaler le score final affiché — sinon un point (typiquement
    // le point "clutch" de fin de match serré) a été crédité à l'équipe
    // sans être attribué à une joueuse précise.
    expect(homePoints).toBe(game.homeScore);
    expect(awayPoints).toBe(game.awayScore);

    for (const entry of boxScore) {
      expect(entry.fieldGoalsAttempted).toBeGreaterThanOrEqual(entry.fieldGoalsMade);
    }
  } finally {
    await prisma.$disconnect();
  }
});
