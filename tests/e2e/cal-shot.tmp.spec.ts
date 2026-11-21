import { test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { onboardNbaTeam } from "./helpers";
import { simulateAndResolveGame } from "../../src/lib/data-access/simulate";
import { toDomainGame } from "../../src/lib/data-access/mappers";
const S = "/tmp/claude-1000/-home-adjia8/6bb053db-38f0-424a-977d-019cc30cda8b/scratchpad";
test("captures calendrier", async ({ page }) => {
  test.setTimeout(600_000);
  const prisma = new PrismaClient();
  const email = await onboardNbaTeam(page, /Lakers/, { tag: "calshot" });
  const m = await prisma.membership.findFirstOrThrow({ where: { user: { email } } });
  for (let d = 0; d < 30; d++) {
    const rows = await prisma.game.findMany({ where: { careerId: m.careerId, status: { not: "final" } }, orderBy: { gameDate: "asc" }, take: 20 });
    const day = rows[0].gameDate.toISOString().slice(0, 10);
    for (const r of rows.filter((r) => r.gameDate.toISOString().slice(0, 10) === day)) await simulateAndResolveGame(m.careerId, toDomainGame(r), "fr");
  }
  await prisma.pressConference.updateMany({ where: { careerId: m.careerId, status: "pending" }, data: { status: "answered" } });
  for (const [vw, w, h] of [["desktop", 1366, 900], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/schedule");
    await page.getByTestId("month-calendar").screenshot({ path: `${S}/cal-${vw}.png` });
    await page.goto("/teams/lal?tab=training");
    const cal = page.getByTestId("training-calendar");
    if (vw === "desktop") { await cal.locator('button[value="save"]').click(); await page.waitForTimeout(2500); await page.reload(); }
    await page.getByTestId("training-calendar").screenshot({ path: `${S}/train-${vw}.png` });
  }
  await prisma.$disconnect();
});
