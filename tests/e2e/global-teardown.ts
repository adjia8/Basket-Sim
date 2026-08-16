import { PrismaClient } from "@prisma/client";
import { cleanupTestUsers, PROTECTED_EMAIL } from "./helpers";

// Nettoie tous les comptes de test créés pendant ce run, puis vérifie que
// le vrai compte du projet est toujours là — si cette assertion échoue,
// c'est un bug critique du nettoyage, pas un détail à ignorer (voir
// README.md).
export default async function globalTeardown(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const deleted = await cleanupTestUsers(prisma);
    console.log(`[global-teardown] Cleaned up ${deleted} test user(s).`);

    const survivor = await prisma.user.findUnique({ where: { email: PROTECTED_EMAIL } });
    if (!survivor) {
      throw new Error(
        `CRITICAL: ${PROTECTED_EMAIL} is missing after test cleanup — the E2E suite may have deleted a real account. Investigate immediately.`
      );
    }
    console.log(`[global-teardown] Verified ${PROTECTED_EMAIL} survives.`);
  } finally {
    await prisma.$disconnect();
  }
}
