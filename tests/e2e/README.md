# E2E tests (Playwright)

Run with `npm run test:e2e` (dev server must be reachable — the config
starts `npm run dev` automatically if nothing is already listening on
`:3000`, and reuses it otherwise).

## Important: no isolated test database

This project has a single Neon Postgres database, shared between local
dev and these tests — there is no separate `TEST_DATABASE_URL`. Every
test run creates real `User`/`Career`/`Membership` rows in that
database and **must** delete them afterward.

Rules that keep this safe:

- Every test user's email starts with `e2e-suite-` (see `helpers.ts`,
  `randomTestEmail()`). Never hardcode a different prefix — the setup/
  teardown cleanup only targets this prefix.
- `global-setup.ts` wipes any leftover `e2e-suite-*` accounts before the
  run starts (in case a previous run was killed mid-test), and
  `global-teardown.ts` wipes them again after, then asserts the real
  account (`adjia8@gmail.com`, hardcoded in `helpers.ts` as
  `PROTECTED_EMAIL`) still exists. If that assertion ever fails, treat
  it as a critical bug in the cleanup logic, not something to silence.
- Tests run with a single worker (`workers: 1` in `playwright.config.ts`)
  specifically so cleanup never races a still-running test.

## Known flakiness

The underlying Neon connection has occasionally hit transient
`P1001`/`P1002` errors during this session (see `src/lib/prisma.ts` for
the retry wrapper) — a failed run that mentions "Can't reach database
server" or "advisory lock" is very likely transient. Re-run before
assuming a real regression.
