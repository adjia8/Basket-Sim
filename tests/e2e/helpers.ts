import type { Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Compte réel de l'utilisateur du projet — ne doit JAMAIS être touché par
// le nettoyage de cette suite (voir README.md).
export const PROTECTED_EMAIL = "adjia8@gmail.com";
export const TEST_EMAIL_PREFIX = "e2e-suite-";
export const TEST_PASSWORD = "TestPass123!";

export function randomTestEmail(tag: string): string {
  return `${TEST_EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
}

// Supprime tous les comptes de test (email préfixé TEST_EMAIL_PREFIX) et
// leur Career associée si plus personne d'autre n'y est rattaché — jamais
// PROTECTED_EMAIL, vérifié après coup par l'appelant (global-teardown.ts).
export async function cleanupTestUsers(prisma: PrismaClient): Promise<number> {
  const users = await prisma.user.findMany({
    where: { email: { contains: TEST_EMAIL_PREFIX } },
  });
  for (const user of users) {
    const membership = await prisma.membership.findUnique({ where: { userId: user.id } });
    if (membership) {
      const remaining = await prisma.membership.count({ where: { careerId: membership.careerId } });
      await prisma.membership.delete({ where: { userId: user.id } });
      if (remaining === 1) {
        await prisma.career.delete({ where: { id: membership.careerId } }).catch(() => {});
      }
    }
    await prisma.user.delete({ where: { id: user.id } });
  }
  return users.length;
}

export interface OnboardedCareer {
  email: string;
  teamHref: string;
  teamName: string;
}

// Parcours complet inscription → choix ligue WNBA → première franchise
// disponible → création GM (répartition de points par défaut, déjà
// équilibrée) → atterrissage sur le dashboard. Reproduit exactement le
// flux qu'un vrai joueur suit à la création d'une carrière.
export async function registerAndOnboardWnbaTeam(page: Page, tag: string): Promise<OnboardedCareer> {
  const email = randomTestEmail(tag);

  await page.goto("/register");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
  await page.waitForURL(/\/onboarding/, { timeout: 20_000 });

  await page.click('button:has-text("WNBA")');
  await page.waitForTimeout(800);

  let teamName = "";
  let chosen = false;
  for (let i = 0; i < 15 && !chosen; i++) {
    const chooseBtn = page.locator('button:has-text("Choisir cette franchise")');
    if ((await chooseBtn.count()) && (await chooseBtn.isEnabled())) {
      teamName = (await page.locator("h3").first().innerText()).trim();
      await chooseBtn.click();
      chosen = true;
    } else {
      await page.click('button:has-text("Suivant")').catch(() => {});
      await page.waitForTimeout(250);
    }
  }
  if (!chosen) throw new Error("No available WNBA franchise found during onboarding");

  await page.waitForTimeout(800);
  const gmFirstName = page.locator('input[name="gmFirstName"]');
  if (await gmFirstName.count()) {
    await gmFirstName.fill("Test");
    await page.fill('input[name="gmLastName"]', "Coach");
    await page.click('button:has-text("Prendre les commandes")');
  }
  await page.waitForURL("/", { timeout: 20_000 });
  await page.waitForTimeout(800);

  const teamHref = await page.locator('a[href^="/teams/"]').first().getAttribute("href");
  if (!teamHref) throw new Error("Could not find my team link on dashboard after onboarding");

  return { email, teamHref, teamName };
}
