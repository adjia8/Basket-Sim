import { PrismaClient } from "@prisma/client";
import { cleanupTestUsers } from "./helpers";

// Nettoie les comptes de test qu'une exécution précédente aurait laissés
// derrière elle (run interrompu, crash) — jamais PROTECTED_EMAIL, voir
// helpers.ts et README.md.
export default async function globalSetup(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const deleted = await cleanupTestUsers(prisma);
    if (deleted > 0) {
      console.log(`[global-setup] Cleaned up ${deleted} leftover test user(s) from a previous run.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
