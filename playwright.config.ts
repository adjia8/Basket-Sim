import { defineConfig, devices } from "@playwright/test";

// Suite E2E critique-path — voir tests/e2e/README.md pour le contexte
// complet (notamment : ces tests écrivent dans la VRAIE base Neon du
// projet, il n'y a pas de base de test isolée).
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // les tests créent/nettoient des comptes dans la même DB partagée — le parallélisme n'apporte rien ici et complique le nettoyage
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 90_000, // le simulate-game route fait beaucoup de requêtes séquentielles — sous latence Neon, une simulation seule peut prendre 30-45s
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--no-sandbox"] } },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
