// Applique une mise à jour des notes du catalogue (NBA 2K) aux carrières en
// cours, sans effacer ce qui s'y est passé.
//
// Chaque joueur d'une carrière retient la note du catalogue avec laquelle il
// a été synchronisé (PlayerState.catalogOverall). Après une mise à jour du
// catalogue (players-nba.ts puis `npx prisma db seed`), cette commande
// applique la DIFFÉRENCE à chaque carrière : un joueur remonté de +2 dans 2K
// gagne +2 dans la carrière (note globale et attributs), en conservant sa
// progression ou son déclin propres à la carrière.
//
// Usage : npm run sync:ratings            (applique)
//         npm run sync:ratings -- --dry-run (affiche sans rien écrire)
//
// Les joueurs sans note de référence (carrières créées avant cette commande)
// reçoivent la note actuelle du catalogue comme référence, sans changement.
//
// Limite connue : les attributs sont bornés à 20-99. Un attribut déjà à 99
// ne monte plus ; si 2K remonte puis redescend le même joueur, cet attribut
// finit légèrement plus bas qu'au départ (négligeable pour des mises à jour
// de ±1 à 3 points).

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const ATTRIBUTES = [
  "scoringInside",
  "scoringOutside",
  "playmaking",
  "defenseInside",
  "defenseOutside",
  "rebounding",
  "athleticism",
  "basketballIQ",
  "clutch",
  "stamina",
] as const;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));

async function main() {
  // Catalogue : joueurs réels (careerId null), pas ceux créés par une draft.
  const catalog = await prisma.player.findMany({ where: { careerId: null }, select: { id: true, overallRating: true } });
  const catalogById = new Map(catalog.map((p) => [p.id, p.overallRating]));
  const careers = await prisma.career.findMany({ select: { id: true, leagueId: true, season: true } });

  let baselined = 0;
  let changed = 0;
  for (const career of careers) {
    const states = await prisma.playerState.findMany({
      where: { careerId: career.id, playerId: { in: [...catalogById.keys()] } },
    });
    const rows: Prisma.Sql[] = [];
    const samples: string[] = [];
    for (const st of states) {
      const target = catalogById.get(st.playerId)!;
      if (st.catalogOverall === null) {
        baselined++;
        rows.push(Prisma.sql`(${st.id}, ${st.overallRating}, ${target}, ${Prisma.join(ATTRIBUTES.map((a) => st[a]))})`);
        continue;
      }
      const delta = target - st.catalogOverall;
      if (delta === 0) continue;
      changed++;
      const overall = clamp(st.overallRating + delta, 30, 99);
      if (samples.length < 8) samples.push(`${st.playerId} ${st.overallRating}→${overall} (${delta > 0 ? "+" : ""}${delta})`);
      rows.push(
        Prisma.sql`(${st.id}, ${overall}, ${target}, ${Prisma.join(ATTRIBUTES.map((a) => clamp(st[a] + delta, 20, 99)))})`
      );
    }
    console.log(`${career.leagueId} ${career.season} (${career.id}) : ${rows.length} mise(s) à jour${samples.length ? " — " + samples.join(", ") : ""}`);
    if (DRY_RUN || rows.length === 0) continue;
    const columns = Prisma.raw(['"id"', '"overallRating"', '"catalogOverall"', ...ATTRIBUTES.map((a) => `"${a}"`)].join(", "));
    const sets = Prisma.raw(
      [
        `"overallRating" = v."overallRating"`,
        `"catalogOverall" = v."catalogOverall"`,
        `"peakOverallRating" = GREATEST(ps."peakOverallRating", v."overallRating")`,
        ...ATTRIBUTES.map((a) => `"${a}" = v."${a}"`),
      ].join(", ")
    );
    for (let i = 0; i < rows.length; i += 200) {
      await prisma.$executeRaw`
        UPDATE "PlayerState" AS ps SET ${sets}
        FROM (VALUES ${Prisma.join(rows.slice(i, i + 200))}) AS v(${columns})
        WHERE ps."id" = v."id"
      `;
    }
  }
  console.log(
    `${DRY_RUN ? "[simulation] " : ""}${careers.length} carrière(s) — ${changed} note(s) modifiée(s), ${baselined} référence(s) initialisée(s).`
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
