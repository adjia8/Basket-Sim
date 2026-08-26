// Les Server Actions de simulation en boucle (voir simulate-bulk.ts) coûtent
// normalement ~20-50s par match, avec un plafond serveur de 60s en
// production (maxDuration sur schedule/page.tsx et page.tsx). En dev local,
// rien ne borne un appel bloqué — un incident de connexion Neon a déjà fait
// "pendre" un appel plus de deux heures sans qu'aucune erreur ne remonte
// (voir prisma.ts : le retry ne rattrape que les erreurs effectivement
// levées, pas un socket qui ne répond juste plus). Cette limite côté CLIENT
// ne peut pas annuler l'exécution serveur en cours, mais évite au moins que
// l'interface reste figée indéfiniment sans explication.
export const BULK_ACTION_TIMEOUT_MS = 90_000;

export class ClientTimeoutError extends Error {
  constructor() {
    super("Client-side timeout waiting for server action");
    this.name = "ClientTimeoutError";
  }
}

export function withClientTimeout<T>(promise: Promise<T>, ms: number = BULK_ACTION_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ClientTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
