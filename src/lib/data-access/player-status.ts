import "server-only";
import { prisma } from "@/lib/prisma";
import {
  MIN_GAMES_FOR_PRODUCTION,
  productionRating,
  type ProductionLine,
} from "@/lib/careers/player-status-rules";

function previousSeason(season: string): string {
  const [a, b] = season.split("-").map(Number);
  return `${a - 1}-${b - 1}`;
}

export interface ProductionInfo {
  rating: number;
  season: string;
  line: ProductionLine;
}

// Production (voir productionRating) de chaque joueur : saison en cours dès
// 10 matchs joués, sinon la saison précédente de la carrière.
export async function getProductionRatings(
  careerId: string,
  season: string,
  playerIds: string[]
): Promise<Map<string, ProductionInfo>> {
  if (playerIds.length === 0) return new Map();
  const prev = previousSeason(season);
  const rows = await prisma.playerSeasonStat.findMany({
    where: { careerId, season: { in: [season, prev] }, playerId: { in: playerIds } },
  });
  // Un joueur échangé a une ligne par équipe : on additionne par saison.
  const totals = new Map<string, { gp: number; pts: number; reb: number; ast: number; stl: number; blk: number; tov: number }>();
  for (const r of rows) {
    const k = `${r.playerId}|${r.season}`;
    const t = totals.get(k) ?? { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0 };
    t.gp += r.gamesPlayed;
    t.pts += r.points;
    t.reb += r.rebounds;
    t.ast += r.assists;
    t.stl += r.steals;
    t.blk += r.blocks;
    t.tov += r.turnovers;
    totals.set(k, t);
  }
  const out = new Map<string, ProductionInfo>();
  for (const id of playerIds) {
    for (const s of [season, prev]) {
      const t = totals.get(`${id}|${s}`);
      if (!t || t.gp < MIN_GAMES_FOR_PRODUCTION) continue;
      const line: ProductionLine = {
        gamesPlayed: t.gp,
        ppg: t.pts / t.gp,
        rpg: t.reb / t.gp,
        apg: t.ast / t.gp,
        spg: t.stl / t.gp,
        bpg: t.blk / t.gp,
        tpg: t.tov / t.gp,
      };
      const rating = productionRating(line);
      if (rating !== null) {
        out.set(id, { rating, season: s, line });
        break;
      }
    }
  }
  return out;
}
