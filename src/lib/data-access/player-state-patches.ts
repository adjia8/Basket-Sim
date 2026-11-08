import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Colonnes de PlayerState modifiées par la résolution d'un match
// (blessures, renommée, entraînement, fatigue/usure, progression — voir
// simulate.ts).
const ATTRIBUTE_COLUMNS = [
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

export interface PlayerStatePatch extends Partial<Record<(typeof ATTRIBUTE_COLUMNS)[number], number>> {
  injured?: boolean;
  injuryGamesRemaining?: number;
  injurySeverity?: string | null;
  playingThroughInjury?: boolean;
  conditioning?: number;
  renown?: number;
  trainingBoost?: number;
  trainingBoostFocus?: string | null;
  fatigue?: number;
  wear?: number;
  restNextGame?: boolean;
  injuryType?: string | null;
  developmentProgress?: number;
  overallRating?: number;
  morale?: number;
}

type Column = keyof PlayerStatePatch;
const COLUMNS: { name: Column; sqlType: "boolean" | "int" | "text" }[] = [
  { name: "injured", sqlType: "boolean" },
  { name: "injuryGamesRemaining", sqlType: "int" },
  { name: "injurySeverity", sqlType: "text" },
  { name: "playingThroughInjury", sqlType: "boolean" },
  { name: "conditioning", sqlType: "int" },
  { name: "renown", sqlType: "int" },
  { name: "trainingBoost", sqlType: "int" },
  { name: "trainingBoostFocus", sqlType: "text" },
  { name: "fatigue", sqlType: "int" },
  { name: "wear", sqlType: "int" },
  { name: "restNextGame", sqlType: "boolean" },
  { name: "injuryType", sqlType: "text" },
  { name: "developmentProgress", sqlType: "int" },
  { name: "overallRating", sqlType: "int" },
  { name: "morale", sqlType: "int" },
  ...ATTRIBUTE_COLUMNS.map((name) => ({ name, sqlType: "int" as const })),
];

// Regroupe toutes les modifications de PlayerState d'un match (une par
// joueur et par étape) pour les écrire en UNE seule requête : chaque
// aller-retour vers la base coûte ~100-250 ms, et un match en produisait
// jusqu'à ~150 (36 joueurs × 4 étapes). Les étapes lisent toutes l'état
// chargé AVANT le match et touchent des colonnes distinctes, donc fusionner
// leurs écritures ne change rien au résultat.
export class PlayerStatePatches {
  private readonly byPlayer = new Map<string, PlayerStatePatch>();

  set(playerId: string, patch: PlayerStatePatch): void {
    this.byPlayer.set(playerId, { ...this.byPlayer.get(playerId), ...patch });
  }

  async apply(careerId: string): Promise<void> {
    if (this.byPlayer.size === 0) return;
    // Pour chaque colonne : un drapeau "modifiée ?" + la valeur — permet de
    // distinguer "remettre à null" de "ne pas toucher" (ex. injurySeverity).
    const rows = [...this.byPlayer].map(
      ([playerId, patch]) =>
        Prisma.sql`(${playerId}::text, ${Prisma.join(
          COLUMNS.flatMap(({ name, sqlType }) => [
            Prisma.sql`${name in patch}::boolean`,
            Prisma.sql`${patch[name] ?? null}::${Prisma.raw(sqlType)}`,
          ])
        )})`
    );
    const valueColumns = Prisma.raw(
      ['"playerId"', ...COLUMNS.flatMap(({ name }) => [`"set_${name}"`, `"${name}"`])].join(", ")
    );
    const assignments = Prisma.raw(
      COLUMNS.map(({ name }) => `"${name}" = CASE WHEN v."set_${name}" THEN v."${name}" ELSE ps."${name}" END`).join(
        ", "
      )
    );
    await prisma.$executeRaw`
      UPDATE "PlayerState" AS ps SET ${assignments}
      FROM (VALUES ${Prisma.join(rows)}) AS v(${valueColumns})
      WHERE ps."careerId" = ${careerId} AND ps."playerId" = v."playerId"
    `;
  }
}
