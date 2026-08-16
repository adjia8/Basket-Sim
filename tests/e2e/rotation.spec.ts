import { test, expect } from "@playwright/test";
import { registerAndOnboardWnbaTeam } from "./helpers";

// Parcours critique #2 : promouvoir une joueuse "hors rotation" via le
// bouton "+" doit survivre à un rechargement de page — couvre la même
// classe de bug que "il n'y a pas d'agents libres de listés" (un état
// visuellement correct côté client qui ne persiste jamais vraiment côté
// serveur). Le bouton +/- est utilisé plutôt que le glisser-déposer :
// déterministe, alors que le drag pointer-based est plus adapté à une
// vérification visuelle manuelle qu'à un test committé.
//
// Note de conception : "En rotation" et "Hors rotation" sont deux
// DÉCOUPAGES à taille fixe (coupure à ROTATION_SIZE, voir mockEngine.ts) du
// même tableau — promouvoir une joueuse ne fait grandir aucune des deux
// listes : elle prend la place de la dernière joueuse active, qui est
// mécaniquement repoussée vers la réserve. Le test vérifie donc que la
// joueuse promue est passée de la réserve à l'actif, pas que les tailles
// changent.
test("promoting a player to the active rotation persists after reload", async ({ page }) => {
  const { teamHref } = await registerAndOnboardWnbaTeam(page, "rotation");

  await page.goto(teamHref);
  await expect(page.getByRole("heading", { name: "Rotation", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Hors rotation/ })).toBeVisible();

  const reserveAddButtons = page.locator('button[aria-label="Ajouter à la rotation"]');
  await expect(reserveAddButtons.first()).toBeVisible();

  const activeList = page.locator("ul").first();
  const activeCountBefore = await activeList.locator("li").count();

  const reserveList = page.locator("ul").nth(1);
  const reserveCountBefore = await reserveList.locator("li").count();
  const reserveFirstRowText = await reserveList.locator("li").first().innerText();
  const nameMatch = reserveFirstRowText.match(/#\d+\s+([^(]+?)\s*\(/);
  if (!nameMatch) throw new Error(`Could not parse player name from row text: ${reserveFirstRowText}`);
  const promotedName = nameMatch[1];

  await reserveAddButtons.first().click();
  // Découpage à taille fixe : les deux listes gardent leur taille (une
  // joueuse active est mécaniquement repoussée en réserve à la place de
  // celle qu'on promeut) — seule la composition change.
  await expect(activeList.locator("li")).toHaveCount(activeCountBefore);
  await expect(reserveList.locator("li")).toHaveCount(reserveCountBefore);
  const activeNamesAfterClick = await activeList.locator("li").allInnerTexts();
  const reserveNamesAfterClick = await reserveList.locator("li").allInnerTexts();
  expect(activeNamesAfterClick.some((row) => row.includes(promotedName))).toBe(true);
  expect(reserveNamesAfterClick.some((row) => row.includes(promotedName))).toBe(false);

  await page.click('button:has-text("Enregistrer la rotation")');
  await expect(page.locator("text=Rotation enregistrée")).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.locator("ul").first().locator("li")).toHaveCount(activeCountBefore);

  const activeNamesAfterReload = await page.locator("ul").first().locator("li").allInnerTexts();
  const promotedIsActive = activeNamesAfterReload.some((row) => row.includes(promotedName));
  expect(promotedIsActive).toBe(true);
});
