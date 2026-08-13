import { Prisma, PrismaClient } from "@prisma/client";

// Neon (base serverless) subit de temps en temps des coupures de connexion
// passagères (P1001 "Can't reach database server", P1002/P1008 timeout,
// P1017 connexion fermée par le serveur, ou une PrismaClientInitializationError
// pure quand la connexion n'a même pas pu s'établir) — observées à plusieurs
// reprises pendant le développement, y compris sur des pages basiques comme
// la connexion. Ce ne sont pas des erreurs de requête (mauvaise query, contrainte
// violée...), donc les réessayer après une courte pause suffit généralement à
// absorber le blip plutôt que de faire planter la page pour l'utilisateur.
const RETRYABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 400;

function isRetryable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) return RETRYABLE_CODES.has(err.code);
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withRetry(client: PrismaClient) {
  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        let lastError: unknown;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            lastError = err;
            if (!isRetryable(err) || attempt === MAX_RETRIES) throw err;
            await sleep(RETRY_DELAY_MS * (attempt + 1));
          }
        }
        throw lastError;
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof withRetry> };

export const prisma = globalForPrisma.prisma ?? withRetry(new PrismaClient());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
